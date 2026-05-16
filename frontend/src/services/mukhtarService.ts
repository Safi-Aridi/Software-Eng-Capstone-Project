// Handles FR-13 (pending application retrieval), FR-15 (electronic signature), FR-16 (status update)

import type { PassportApplication, EnrichedApplication } from "./applicationService";
import { getIdentityForUser } from "./applicationService";
import { notificationService } from "./notificationService";
import { apiClient } from "./apiClient";
import { mapApiApplicationToFrontend } from "../utils/apiAdapters";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_MUKHTAR === "true";

// In real-auth mode the authoritative userId lives in npis_session. The
// component still passes a value, but we override it so the backend always
// sees the JWT-aligned UUID.
const getSessionUserId = (): string | null => {
  try {
    const raw = localStorage.getItem("npis_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string };
    return parsed.userId ?? null;
  } catch {
    return null;
  }
};

export interface MukhtarQueueItem {
  applicationId: string;
  citizenName: string;
  submissionDate: string;
  applicationType: "NEW" | "RENEWAL";
  currentStatus: string;
  jurisdiction: string;
  documents: object;
}

export interface MukhtarSignature {
  signatureId: string;
  algorithm: string;
  timestamp: string;
  signedBy: string;
  digest: string;
}

const signatureKey = (applicationId: string) =>
  `mukhtar_signature_${applicationId}`;

// Scans all applications_* keys and returns those matching the given status
const scanApplicationsByStatus = (
  status: string,
): PassportApplication[] => {
  const result: PassportApplication[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("applications_")) continue;
    try {
      const apps: PassportApplication[] = JSON.parse(
        localStorage.getItem(key) || "[]",
      );
      result.push(...apps.filter((a) => a.currentStatus === status));
    } catch {
      // skip malformed entries
    }
  }
  return result;
};

// Updates an application across all applications_* keys by applicationId
const updateApplicationInStorage = (
  applicationId: string,
  updater: (app: PassportApplication) => PassportApplication,
): void => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("applications_")) continue;
    try {
      const apps: PassportApplication[] = JSON.parse(
        localStorage.getItem(key) || "[]",
      );
      const idx = apps.findIndex((a) => a.applicationId === applicationId);
      if (idx >= 0) {
        apps[idx] = updater(apps[idx]);
        localStorage.setItem(key, JSON.stringify(apps));
        break;
      }
    } catch {
      // skip malformed entries
    }
  }
};

export const mukhtarService = {
  // FR-13 — Retrieve applications pending mukhtar endorsement (enriched with citizen identity)
  getPendingApplicationsFull: async (
    _mukhtarId: string,
  ): Promise<EnrichedApplication[]> => {
    if (USE_MOCK) {
      const apps = scanApplicationsByStatus("VERIFIED");
      return apps.map((app) => ({
        app,
        citizenIdentity: getIdentityForUser(app.userId),
      }));
    }
    const rows = await apiClient.get<unknown[]>("/mukhtar/pending");
    return rows.map((raw) => ({
      app: mapApiApplicationToFrontend(raw),
      // Citizen identity lives only in localStorage until the KYC endpoint is wired
      citizenIdentity: null,
    }));
  },

  // FR-15, FR-16 — Electronically sign and update application status to MUKHTAR_SIGNED
  signApplication: async (
    mukhtarId: string,
    applicationId: string,
  ): Promise<void> => {
    if (USE_MOCK) {
      const signature: MukhtarSignature = {
        signatureId: `sig_${applicationId}_${Date.now()}`,
        algorithm: "RSA-SHA256",
        timestamp: new Date().toISOString(),
        signedBy: mukhtarId,
        digest: `mock-digest-${Math.random().toString(36).slice(2)}`,
      };

      // Persist signature separately for officer dashboard lookup
      localStorage.setItem(signatureKey(applicationId), JSON.stringify(signature));

      let citizenUserId: string | null = null;
      let trackingNumber = "";
      updateApplicationInStorage(applicationId, (app) => {
        citizenUserId = app.userId;
        trackingNumber = app.trackingNumber;
        return {
          ...app,
          currentStatus: "MUKHTAR_SIGNED",
          statusHistory: [
            ...(app.statusHistory ?? []),
            { status: "MUKHTAR_SIGNED" as const, timestamp: signature.timestamp },
          ],
        };
      });

      // TODO: Remove when backend is connected — NestJS handles notification creation server-side
      if (citizenUserId) {
        notificationService.create(citizenUserId, {
          userId: citizenUserId,
          type: "STATUS_UPDATE",
          title: "Mukhtar Signed",
          message: `Your application ${trackingNumber} has been signed by your Mukhtar and is being processed by General Security.`,
          applicationId,
        });
      }
      return;
    }

    const resolvedMukhtarId = getSessionUserId() ?? mukhtarId;
    await apiClient.post(`/applications/${applicationId}/sign`, {
      mukhtarId: resolvedMukhtarId,
    });
    // TODO: Remove when backend is connected — NestJS handles notification creation server-side
    notificationService.create("", {
      userId: "",
      type: "STATUS_UPDATE",
      title: "Mukhtar Signed",
      message: `Application ${applicationId} has been signed by the Mukhtar.`,
      applicationId,
    });
  },

  // FR-16, FR-22 — Request document resubmission with per-document reasons
  rejectApplication: async (
    mukhtarId: string,
    applicationId: string,
    resubmissionReasons?: PassportApplication["resubmissionReasons"],
  ): Promise<{ success: boolean }> => {
    if (!USE_MOCK) {
      const resolvedMukhtarId = getSessionUserId() ?? mukhtarId;
      return apiClient.post<{ success: boolean }>(
        `/mukhtar/applications/${applicationId}/reject`,
        {
          mukhtarId: resolvedMukhtarId,
          resubmissionReasons,
        },
      );
    }

    const timestamp = new Date().toISOString();
    let citizenUserId: string | null = null;
    let trackingNumber = "";
    updateApplicationInStorage(applicationId, (app) => {
      citizenUserId = app.userId;
      trackingNumber = app.trackingNumber;
      return {
        ...app,
        currentStatus: "RESUBMISSION_REQUIRED",
        resubmissionReasons: resubmissionReasons ?? app.resubmissionReasons,
        statusHistory: [
          ...(app.statusHistory ?? []),
          { status: "RESUBMISSION_REQUIRED" as const, timestamp },
        ],
      };
    });

    // TODO: Remove when backend is connected — NestJS handles notification creation server-side
    if (citizenUserId) {
      notificationService.create(citizenUserId, {
        userId: citizenUserId,
        type: "RESUBMISSION_REQUIRED",
        title: "Resubmission Required",
        message: `Action required: Your Mukhtar has requested corrections for application ${trackingNumber}.`,
        applicationId,
      });
    }
    return { success: true };
  },

  // Alias for spec naming
  requestResubmission: async (
    mukhtarId: string,
    applicationId: string,
    resubmissionReasons: PassportApplication["resubmissionReasons"],
  ): Promise<{ success: boolean }> => {
    return mukhtarService.rejectApplication(
      mukhtarId,
      applicationId,
      resubmissionReasons,
    );
  },

  // Retrieve stored mukhtar signature for a given application
  getStoredSignature: (applicationId: string): MukhtarSignature | null => {
    const stored = localStorage.getItem(signatureKey(applicationId));
    if (!stored) return null;
    try {
      return JSON.parse(stored) as MukhtarSignature;
    } catch {
      return null;
    }
  },

  // TODO: Real electronic signature generation (FR-15)
  getSignatureMetadata: (applicationId: string, mukhtarId: string): object => {
    return {
      signatureId: `sig_${applicationId}_${Date.now()}`,
      algorithm: "RSA-SHA256",
      timestamp: new Date().toISOString(),
      signedBy: mukhtarId,
      digest: `mock-digest-${Math.random().toString(36).slice(2)}`,
    };
  },
};
