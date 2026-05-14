// Passport entity service — owns ACTIVE/CANCELLED records and the expiry banner data source.
// Replaces the application-deliveredDate-driven banner logic introduced in Session 10.

import type { Passport } from "../types/passport";
import type { PassportApplication } from "./applicationService";
import { apiClient } from "./apiClient";
import { mapApiApplicationToFrontend, snakeToCamel } from "../utils/apiAdapters";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_PASSPORTS === "true";

export type ExpirySeverity = "info" | "warning" | "critical" | "expired";

export interface ExpiringPassport {
  passport: Passport;
  daysUntilExpiry: number;
  expiryDate: string;
  severity: ExpirySeverity;
}

const passportsKey = (userId: string) => `passports_${userId}`;
const dismissalKey = (passportId: string) =>
  `expiry_banner_dismissed_${passportId}`;

const readPassports = (userId: string): Passport[] => {
  const stored = localStorage.getItem(passportsKey(userId));
  if (!stored) return [];
  try {
    return JSON.parse(stored) as Passport[];
  } catch {
    return [];
  }
};

const writePassports = (userId: string, passports: Passport[]): void => {
  localStorage.setItem(passportsKey(userId), JSON.stringify(passports));
};

const mapApiPassport = (raw: unknown): Passport => {
  const c = snakeToCamel(raw) as Record<string, unknown>;
  return {
    passportId: (c.passportId as string) ?? "",
    userId: (c.userId as string) ?? "",
    sourceApplicationId: (c.sourceApplicationId as string) ?? "",
    bookletNumber: (c.bookletNumber as string) ?? "",
    status: ((c.status as string) ?? "ACTIVE") as Passport["status"],
    issuedAt: (c.issuedAt as string) ?? "",
    expiresAt: (c.expiresAt as string) ?? "",
    cancelledAt: (c.cancelledAt as string | null) ?? null,
    cancelledByApplicationId:
      (c.cancelledByApplicationId as string | null) ?? null,
  };
};

// Find an application across all citizens' application stores (mock mode only).
const findApplication = (
  applicationId: string,
): PassportApplication | null => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("applications_")) continue;
    try {
      const apps: PassportApplication[] = JSON.parse(
        localStorage.getItem(key) || "[]",
      );
      const found = apps.find((a) => a.applicationId === applicationId);
      if (found) return found;
    } catch {
      // skip malformed
    }
  }
  return null;
};

// Find an owning passport record across all citizen stores by passportId (mock).
const findPassportOwner = (
  passportId: string,
): { userId: string; passport: Passport } | null => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("passports_")) continue;
    const userId = key.slice("passports_".length);
    try {
      const passports: Passport[] = JSON.parse(
        localStorage.getItem(key) || "[]",
      );
      const found = passports.find((p) => p.passportId === passportId);
      if (found) return { userId, passport: found };
    } catch {
      // skip malformed
    }
  }
  return null;
};

const generatePassportId = (): string => {
  const n = Math.floor(10_000_000 + Math.random() * 90_000_000);
  return `LBPP-${n}`;
};

export const passportService = {
  createPassport: async (
    userId: string,
    sourceApplicationId: string,
    bookletNumber: string,
  ): Promise<Passport> => {
    if (!USE_MOCK) {
      // Issuance creates the passport server-side via
      // POST /api/applications/:id/issue (officerService.issueApplication).
      // Keep this function for legacy callers but make it a no-op pass-through.
      return {
        passportId: "",
        userId,
        sourceApplicationId,
        bookletNumber,
        status: "ACTIVE",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        cancelledAt: null,
        cancelledByApplicationId: null,
      };
    }

    const sourceApp = findApplication(sourceApplicationId);
    const validityYears = sourceApp?.passportValidity ?? 5;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + validityYears);

    const passport: Passport = {
      passportId: generatePassportId(),
      userId,
      sourceApplicationId,
      bookletNumber,
      status: "ACTIVE",
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      cancelledAt: null,
      cancelledByApplicationId: null,
    };

    const existing = readPassports(userId);
    existing.push(passport);
    writePassports(userId, existing);
    return passport;
  },

  getPassportsByUser: async (userId: string): Promise<Passport[]> => {
    if (!USE_MOCK) {
      const rows = await apiClient.get<unknown[]>(
        `/passports?userId=${encodeURIComponent(userId)}`,
      );
      return rows.map(mapApiPassport);
    }
    return readPassports(userId);
  },

  getActivePassport: async (userId: string): Promise<Passport | null> => {
    const all = await passportService.getPassportsByUser(userId);
    return all.find((p) => p.status === "ACTIVE") ?? null;
  },

  cancelPassport: async (
    passportId: string,
    cancelledByApplicationId: string,
  ): Promise<void> => {
    if (!USE_MOCK) {
      // Server cancels the renewed passport inside issueApplication.
      // Keep this function for any frontend callers but treat it as a no-op.
      return;
    }
    const owner = findPassportOwner(passportId);
    if (!owner) return;
    const { userId } = owner;
    const passports = readPassports(userId);
    const idx = passports.findIndex((p) => p.passportId === passportId);
    if (idx < 0) return;
    passports[idx] = {
      ...passports[idx],
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
      cancelledByApplicationId,
    };
    writePassports(userId, passports);
  },

  // Returns ACTIVE passports whose expiry is within 6 months — with severity
  // metadata. Suppresses banners when an active+paid renewal application exists
  // for the passport (mock-only logic).
  getExpiringPassports: async (
    userId: string,
  ): Promise<ExpiringPassport[]> => {
    let passports: Passport[];
    if (!USE_MOCK) {
      const rows = await apiClient.get<unknown[]>(
        `/passports/expiring?userId=${encodeURIComponent(userId)}`,
      );
      passports = rows.map(mapApiPassport);
    } else {
      passports = readPassports(userId);
    }

    const apps: PassportApplication[] = await (async () => {
      if (!USE_MOCK) {
        const rows = await apiClient.get<unknown[]>("/applications");
        return rows.map(mapApiApplicationToFrontend);
      }

      const stored = localStorage.getItem(`applications_${userId}`);
      if (!stored) return [];
      try {
        return JSON.parse(stored) as PassportApplication[];
      } catch {
        return [];
      }
    })();

    const now = Date.now();
    const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
    const SUPPRESSING_STATUSES = new Set([
      "PENDING_REVIEW",
      "VERIFIED",
      "MUKHTAR_SIGNED",
      "PROCESSED",
      "ISSUED",
    ]);

    const result: ExpiringPassport[] = [];
    for (const passport of passports) {
      if (passport.status !== "ACTIVE") continue;
      const expiryTime = new Date(passport.expiresAt).getTime();
      const msUntil = expiryTime - now;
      // The backend already filters to <= 6 months, but the mock path needs this guard.
      if (msUntil > sixMonthsMs) continue;

      // Suppression: an active, paid renewal targeting this passport hides the banner.
      const suppressing = apps.find(
        (a) =>
          a.renewingPassportId === passport.passportId &&
          SUPPRESSING_STATUSES.has(a.currentStatus) &&
          a.paymentStatus === "Paid",
      );
      if (suppressing) continue;

      const daysUntilExpiry = Math.ceil(msUntil / (1000 * 60 * 60 * 24));
      let severity: ExpirySeverity;
      if (msUntil <= 0) severity = "expired";
      else if (daysUntilExpiry < 30) severity = "critical";
      else if (daysUntilExpiry < 90) severity = "warning";
      else severity = "info";

      // Honor info-tier dismissal unless severity has escalated since dismissal.
      const dismissalRaw = localStorage.getItem(
        dismissalKey(passport.passportId),
      );
      if (dismissalRaw && severity === "info") {
        try {
          const stored = JSON.parse(dismissalRaw) as {
            dismissedAt: string;
            severity: ExpirySeverity;
          };
          if (stored.severity === "info") continue;
        } catch {
          // ignore malformed
        }
      }

      result.push({
        passport,
        daysUntilExpiry,
        expiryDate: passport.expiresAt,
        severity,
      });
    }

    const order: Record<ExpirySeverity, number> = {
      expired: 0,
      critical: 1,
      warning: 2,
      info: 3,
    };
    result.sort((a, b) => order[a.severity] - order[b.severity]);
    return result;
  },

  dismissExpiryBanner: async (
    passportId: string,
    severity: ExpirySeverity = "info",
  ): Promise<void> => {
    localStorage.setItem(
      dismissalKey(passportId),
      JSON.stringify({ dismissedAt: new Date().toISOString(), severity }),
    );
  },
};
