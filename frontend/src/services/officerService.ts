// Handles FR-17 (queue retrieval), FR-18 (final approval), FR-19 (old passport cancellation)

import type { PassportApplication, EnrichedApplication } from "./applicationService";
import { getIdentityForUser } from "./applicationService";
import { mukhtarService } from "./mukhtarService";
import { notificationService } from "./notificationService";
import { apiClient } from "./apiClient";
import { mapApiApplicationToFrontend } from "../utils/apiAdapters";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_OFFICER === "true";

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

export const officerService = {
  // FR-17 — Retrieve applications awaiting final officer processing (enriched)
  getProcessingQueueFull: async (
    _officerId: string,
  ): Promise<EnrichedApplication[]> => {
    if (USE_MOCK) {
      const apps = scanApplicationsByStatus("MUKHTAR_SIGNED");
      return apps.map((app) => ({
        app,
        citizenIdentity: getIdentityForUser(app.userId),
      }));
    }
    const rows = await apiClient.get<unknown[]>("/officer/pending");
    return rows.map((raw) => ({
      app: mapApiApplicationToFrontend(raw),
      // Citizen identity lives only in localStorage until the KYC endpoint is wired
      citizenIdentity: null,
    }));
  },

  // FR-18 — Retrieve applications ready for final officer processing (basic)
  // TODO: GET /api/officer/applications?status=MUKHTAR_SIGNED
  getProcessingQueue: async (
    _officerId: string,
  ): Promise<PassportApplication[]> => {
    return scanApplicationsByStatus("MUKHTAR_SIGNED");
  },

  // FR-18 (extension) — Retrieve applications awaiting passport issuance (PROCESSED → ISSUED)
  // Stays mocked — no backend endpoint for issuance queue yet
  // TODO: GET /api/officer/applications?status=PROCESSED
  getIssuanceQueueFull: async (
    _officerId: string,
  ): Promise<EnrichedApplication[]> => {
    const apps = scanApplicationsByStatus("PROCESSED");
    return apps.map((app) => ({
      app,
      citizenIdentity: getIdentityForUser(app.userId),
    }));
  },

  // FR-18 — Final approval; transitions application to PROCESSED
  approveApplication: async (
    _officerId: string,
    applicationId: string,
    options?: { suppressNotification?: boolean },
  ): Promise<{ success: boolean }> => {
    if (USE_MOCK) {
      const timestamp = new Date().toISOString();
      let citizenUserId: string | null = null;
      let trackingNumber = "";
      updateApplicationInStorage(applicationId, (app) => {
        citizenUserId = app.userId;
        trackingNumber = app.trackingNumber;
        return {
          ...app,
          currentStatus: "PROCESSED",
          statusHistory: [
            ...(app.statusHistory ?? []),
            { status: "PROCESSED" as const, timestamp },
          ],
        };
      });

      // TODO: Remove when backend is connected — NestJS handles notification creation server-side
      if (citizenUserId && !options?.suppressNotification) {
        notificationService.create(citizenUserId, {
          userId: citizenUserId,
          type: "STATUS_UPDATE",
          title: "Application Approved for Printing",
          message: `Your application ${trackingNumber} has been approved and sent for passport printing.`,
          applicationId,
        });
      }
      return { success: true };
    }

    await apiClient.post(`/applications/${applicationId}/approve`, {
      officerId: _officerId,
    });
    // TODO: Remove when backend is connected — NestJS handles notification creation server-side
    notificationService.create("", {
      userId: "",
      type: "STATUS_UPDATE",
      title: "Application Approved for Printing",
      message: `Application ${applicationId} has been approved and sent for passport printing.`,
      applicationId,
    });
    return { success: true };
  },

  // FR-19 — Record old passport cancellation; emits combined renewal notification
  // Stays mocked — no backend endpoint yet
  // TODO: POST /api/officer/applications/:id/cancel-old-passport (FR-19)
  cancelOldPassport: async (
    officerId: string,
    applicationId: string,
    mrzReference: string,
    officerName?: string,
  ): Promise<{ success: boolean }> => {
    const cancellationKey = `cancelled_passport_${applicationId}`;
    const cancelledAt = new Date().toISOString();
    localStorage.setItem(
      cancellationKey,
      JSON.stringify({
        applicationId,
        officerId,
        officerName: officerName ?? null,
        cancelledAt,
        mrzReference,
      }),
    );

    // Look up citizen userId + tracking number for notification
    let citizenUserId: string | null = null;
    let trackingNumber = "";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("applications_")) continue;
      try {
        const apps: PassportApplication[] = JSON.parse(
          localStorage.getItem(key) || "[]",
        );
        const found = apps.find((a) => a.applicationId === applicationId);
        if (found) {
          citizenUserId = found.userId;
          trackingNumber = found.trackingNumber;
          break;
        }
      } catch {
        // skip malformed
      }
    }

    // TODO: Remove when backend is connected — NestJS handles notification creation server-side
    if (citizenUserId) {
      notificationService.create(citizenUserId, {
        userId: citizenUserId,
        type: "STATUS_UPDATE",
        title: "Renewal Approved",
        message: `Your passport renewal ${trackingNumber} has been approved. Your previous passport has been officially cancelled in the registry.`,
        applicationId,
      });
    }
    return { success: true };
  },

  // FR-18 (extension) — Second officer action: passport issuance.
  // Stays mocked — no backend endpoint for issuance yet.
  // TODO: POST /api/officer/applications/:id/issue
  issueApplication: async (
    _officerId: string,
    applicationId: string,
    bookletNumber: string,
    options?: { isRenewal?: boolean },
  ): Promise<{ success: boolean }> => {
    const timestamp = new Date().toISOString();
    let citizenUserId: string | null = null;
    let trackingNumber = "";
    updateApplicationInStorage(applicationId, (app) => {
      citizenUserId = app.userId;
      trackingNumber = app.trackingNumber;
      return {
        ...app,
        currentStatus: "ISSUED",
        statusHistory: [
          ...(app.statusHistory ?? []),
          { status: "ISSUED" as const, timestamp },
        ],
      };
    });

    // TODO: Remove when backend is connected — NestJS handles notification creation server-side
    if (citizenUserId) {
      const renewalSuffix = options?.isRenewal
        ? " Your old passport has been cancelled."
        : "";
      notificationService.create(citizenUserId, {
        userId: citizenUserId,
        type: "STATUS_UPDATE",
        title: "Passport Issued",
        message: `Your new passport (booklet: ${bookletNumber}) has been issued and handed to LibanPost for delivery.${renewalSuffix}`,
        applicationId,
      });
    }
    return { success: true };
  },

  // Look up mukhtar signature for an application (displayed in officer detail panel)
  getSignatureForApplication: (applicationId: string) => {
    return mukhtarService.getStoredSignature(applicationId);
  },
};
