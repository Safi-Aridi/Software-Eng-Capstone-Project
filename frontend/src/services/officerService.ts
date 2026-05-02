// Handles FR-17 (queue retrieval), FR-18 (final approval), FR-19 (old passport cancellation)

import type { PassportApplication, EnrichedApplication } from "./applicationService";
import { getIdentityForUser } from "./applicationService";
import { mukhtarService } from "./mukhtarService";
import { notificationService } from "./notificationService";

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
  // TODO: GET /api/officer/applications?status=MUKHTAR_SIGNED
  getProcessingQueueFull: async (
    _officerId: string,
  ): Promise<EnrichedApplication[]> => {
    const apps = scanApplicationsByStatus("MUKHTAR_SIGNED");
    return apps.map((app) => ({
      app,
      citizenIdentity: getIdentityForUser(app.userId),
    }));
  },

  // FR-18 — Retrieve applications ready for final officer processing (basic)
  // TODO: GET /api/officer/applications?status=MUKHTAR_SIGNED
  getProcessingQueue: async (
    _officerId: string,
  ): Promise<PassportApplication[]> => {
    return scanApplicationsByStatus("MUKHTAR_SIGNED");
  },

  // FR-18 — Final approval; transitions application to PROCESSED
  // TODO: POST /api/officer/applications/:id/approve (FR-18)
  approveApplication: async (
    _officerId: string,
    applicationId: string,
  ): Promise<void> => {
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

    // TODO: Remove when backend is connected — server creates this notification
    if (citizenUserId) {
      notificationService.create(citizenUserId, {
        userId: citizenUserId,
        type: "STATUS_UPDATE",
        title: "Application Processed",
        message: `Your passport application ${trackingNumber} has been approved and is being processed for delivery.`,
        applicationId,
      });
    }
  },

  // FR-19 — Record old passport cancellation before issuing a renewal
  // TODO: POST /api/officer/applications/:id/cancel-old-passport (FR-19)
  cancelOldPassport: async (
    officerId: string,
    applicationId: string,
    oldPassportNumber: string,
  ): Promise<void> => {
    const cancellationKey = `cancelled_passport_${applicationId}`;
    localStorage.setItem(
      cancellationKey,
      JSON.stringify({
        applicationId,
        oldPassportNumber,
        cancelledAt: new Date().toISOString(),
        cancelledBy: officerId,
      }),
    );
  },

  // Look up mukhtar signature for an application (displayed in officer detail panel)
  getSignatureForApplication: (applicationId: string) => {
    return mukhtarService.getStoredSignature(applicationId);
  },
};
