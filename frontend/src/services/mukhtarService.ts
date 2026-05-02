// Handles FR-13 (pending application retrieval), FR-15 (electronic signature), FR-16 (status update)

import type { PassportApplication, EnrichedApplication } from "./applicationService";
import { getIdentityForUser } from "./applicationService";
import { notificationService } from "./notificationService";

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
  // TODO: GET /api/mukhtar/applications?status=VERIFIED
  getPendingApplicationsFull: async (
    _mukhtarId: string,
  ): Promise<EnrichedApplication[]> => {
    const apps = scanApplicationsByStatus("VERIFIED");
    return apps.map((app) => ({
      app,
      citizenIdentity: getIdentityForUser(app.userId),
    }));
  },

  // FR-15, FR-16 — Electronically sign and update application status to MUKHTAR_SIGNED
  // TODO: POST /api/mukhtar/applications/:id/sign (FR-15, FR-16)
  signApplication: async (
    mukhtarId: string,
    applicationId: string,
  ): Promise<void> => {
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

    // TODO: Remove when backend is connected — server creates this notification
    if (citizenUserId) {
      notificationService.create(citizenUserId, {
        userId: citizenUserId,
        type: "STATUS_UPDATE",
        title: "Mukhtar Signed",
        message: `Your application ${trackingNumber} has been signed by the mukhtar and forwarded for processing.`,
        applicationId,
      });
    }
  },

  // FR-16 — Request document resubmission (rejection from mukhtar queue)
  // TODO: POST /api/mukhtar/applications/:id/reject
  rejectApplication: async (
    _mukhtarId: string,
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
        currentStatus: "RESUBMISSION_REQUIRED",
        statusHistory: [
          ...(app.statusHistory ?? []),
          { status: "RESUBMISSION_REQUIRED" as const, timestamp },
        ],
      };
    });

    // TODO: Remove when backend is connected — server creates this notification
    if (citizenUserId) {
      notificationService.create(citizenUserId, {
        userId: citizenUserId,
        type: "RESUBMISSION_REQUIRED",
        title: "Resubmission Required",
        message: `Action required on application ${trackingNumber}: documents need to be resubmitted.`,
        applicationId,
      });
    }
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
