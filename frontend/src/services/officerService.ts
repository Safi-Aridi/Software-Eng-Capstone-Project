// Handles FR-18 (final approval), FR-19 (old passport cancellation)

import type { PassportApplication } from "./applicationService";

export const officerService = {
  // FR-18 — Retrieve applications ready for final officer processing
  // TODO: GET /api/officer/applications?status=MUKHTAR_SIGNED
  getProcessingQueue: async (
    _officerId: string,
  ): Promise<PassportApplication[]> => {
    const result: PassportApplication[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("applications_")) continue;
      try {
        const apps: PassportApplication[] = JSON.parse(
          localStorage.getItem(key) || "[]",
        );
        result.push(...apps.filter((a) => a.currentStatus === "MUKHTAR_SIGNED"));
      } catch {
        // skip malformed entries
      }
    }
    return result;
  },

  // FR-18 — Final approval; transitions application to PROCESSED
  // TODO: POST /api/officer/applications/:id/approve (FR-18)
  approveApplication: async (
    _officerId: string,
    applicationId: string,
  ): Promise<void> => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("applications_")) continue;
      try {
        const apps: PassportApplication[] = JSON.parse(
          localStorage.getItem(key) || "[]",
        );
        const idx = apps.findIndex((a) => a.applicationId === applicationId);
        if (idx >= 0) {
          apps[idx] = {
            ...apps[idx],
            currentStatus: "PROCESSED",
            statusHistory: [
              ...(apps[idx].statusHistory ?? []),
              {
                status: "PROCESSED" as const,
                timestamp: new Date().toISOString(),
              },
            ],
          };
          localStorage.setItem(key, JSON.stringify(apps));
          break;
        }
      } catch {
        // skip malformed entries
      }
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
};
