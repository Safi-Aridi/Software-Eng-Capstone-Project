// Handles FR-13 (pending application retrieval), FR-15 (electronic signature), FR-16 (status update)

import type { PassportApplication } from "./applicationService";

export interface MukhtarQueueItem {
  applicationId: string;
  citizenName: string;
  submissionDate: string;
  applicationType: "NEW" | "RENEWAL";
  currentStatus: string;
  jurisdiction: string;
  documents: object;
}

export const mukhtarService = {
  // FR-13 — Retrieve applications pending mukhtar endorsement
  // TODO: GET /api/mukhtar/applications?status=VERIFIED
  getPendingApplications: async (
    _mukhtarId: string,
  ): Promise<MukhtarQueueItem[]> => {
    const result: MukhtarQueueItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("applications_")) continue;
      try {
        const apps: PassportApplication[] = JSON.parse(
          localStorage.getItem(key) || "[]",
        );
        for (const app of apps) {
          if (app.currentStatus === "VERIFIED") {
            result.push({
              applicationId: app.applicationId,
              citizenName: app.mukhtarFormData?.mukhtarName || "Unknown",
              submissionDate: app.submissionDate,
              applicationType: app.applicationType,
              currentStatus: app.currentStatus,
              jurisdiction: app.mukhtarFormData?.district || "",
              documents: app.documents,
            });
          }
        }
      } catch {
        // skip malformed entries
      }
    }
    return result;
  },

  // FR-15, FR-16 — Electronically sign and update application status to MUKHTAR_SIGNED
  // TODO: POST /api/mukhtar/applications/:id/sign (FR-15, FR-16)
  signApplication: async (
    mukhtarId: string,
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
          const signatureMetadata = mukhtarService.getSignatureMetadata(
            applicationId,
            mukhtarId,
          );
          (apps[idx] as PassportApplication & { signatureMetadata: object }) = {
            ...apps[idx],
            currentStatus: "MUKHTAR_SIGNED",
            statusHistory: [
              ...(apps[idx].statusHistory ?? []),
              {
                status: "MUKHTAR_SIGNED" as const,
                timestamp: new Date().toISOString(),
              },
            ],
            signatureMetadata,
          };
          localStorage.setItem(key, JSON.stringify(apps));
          break;
        }
      } catch {
        // skip malformed entries
      }
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
