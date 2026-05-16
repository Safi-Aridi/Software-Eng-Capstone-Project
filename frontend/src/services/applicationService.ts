import { notificationService } from "./notificationService";
import { apiClient } from "./apiClient";
import {
  mapApiApplicationToFrontend,
  frontendAppTypeToBackend,
  frontendStatusToBackend,
} from "../utils/apiAdapters";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_APPLICATIONS === "true";

export type ApplicationType = "NEW" | "RENEWAL";
export type IdentityDocumentType = "NATIONAL_ID" | "CIVIL_REGISTRY_EXTRACT";

export type ApplicationStatus =
  | "PENDING_REVIEW"
  | "FINGERPRINT_REQUIRED"
  | "VERIFIED" // legacy — pre-migration-007 rows
  | "MUKHTAR_SIGNED"
  | "PROCESSED"
  | "ISSUED"
  | "RESUBMISSION_REQUIRED"
  | "DELIVERED";

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  timestamp: string;
}

export interface PassportApplication {
  applicationId: string;
  userId: string;
  applicationType: ApplicationType;
  currentStatus: ApplicationStatus;
  submissionDate: string;
  trackingNumber: string;
  passportValidity: 5 | 10;
  feeAmount: number;
  paymentStatus?: "UNPAID" | "Paid" | "Failed";
  identityDocumentType?: IdentityDocumentType | null;
  documents: {
    // Legacy generic identity document field kept for old mock/seeded records.
    identityDocument?: string | null;
    frontUrl?: string | null;
    backUrl?: string | null;
    civilRegistryExtract?: string | null;
    passportPhoto: string | null;
    oldPassport: string | null;
  };
  mukhtarFormData: {
    address: string;
    district: string;
    mukhtarName: string;
    // P4-F: mukhtar_profiles.mukhtar_id of the chosen mukhtar (empty when the
    // citizen proceeded with no mukhtar selected — only the legacy free-text
    // mukhtarName is available in that case).
    selectedMukhtarId?: string;
  };
  biometricCaptured: boolean;
  // For RENEWAL applications: the passportId of the passport being renewed.
  // Populated when the citizen arrives via ?fromExpiry=<applicationId> by
  // resolving applicationId → passportId at creation time. Null for NEW
  // applications and renewals started without the expiry banner — banner
  // suppression won't apply in that v1 case.
  renewingPassportId?: string | null;
  statusHistory?: StatusHistoryEntry[];
  // Per-document rejection reasons populated when status is RESUBMISSION_REQUIRED
  resubmissionReasons?: {
    identityDocument?: string;
    frontUrl?: string;
    backUrl?: string;
    civilRegistryExtract?: string;
    passportPhoto?: string;
    oldPassport?: string;
  };
}

export interface CitizenIdentity {
  fullName: string;
  registryNumber: string;
  dateOfBirth?: string;
  dob?: string;
  documentType?: string;
}

export interface EnrichedApplication {
  app: PassportApplication;
  citizenIdentity: CitizenIdentity | null;
}

export const getIdentityForUser = (userId: string): CitizenIdentity | null => {
  const stored = localStorage.getItem(`identity_data_${userId}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as CitizenIdentity;
  } catch {
    return null;
  }
};

export const inferIdentityDocumentType = (
  documents: PassportApplication["documents"],
): IdentityDocumentType | null => {
  if (documents.frontUrl || documents.backUrl) return "NATIONAL_ID";
  if (documents.civilRegistryExtract) return "CIVIL_REGISTRY_EXTRACT";
  return null;
};

const applicationsKey = (userId: string) => `applications_${userId}`;

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

// Internal sync helper — used within this module only
const readApplications = (userId: string): PassportApplication[] => {
  const stored = localStorage.getItem(applicationsKey(userId));
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const applicationService = {
  // FR-10 — List citizen applications
  getApplications: async (userId: string): Promise<PassportApplication[]> => {
    if (USE_MOCK) {
      return readApplications(userId);
    }
    const rows = await apiClient.get<unknown[]>("/applications");
    return rows
      .map(mapApiApplicationToFrontend)
      .filter((a) => a.userId === userId);
  },

  // FR-10 — Get single application by ID
  getApplicationById: async (
    userId: string,
    applicationId: string,
  ): Promise<PassportApplication | null> => {
    if (USE_MOCK) {
      return (
        readApplications(userId).find((a) => a.applicationId === applicationId) ??
        null
      );
    }
    try {
      const raw = await apiClient.get<unknown>(`/applications/${applicationId}`);
      return mapApiApplicationToFrontend(raw);
    } catch {
      return null;
    }
  },

  // FR-06, FR-08 — Submit new passport application
  createApplication: async (
    userId: string,
    application: PassportApplication,
  ): Promise<PassportApplication> => {
    if (USE_MOCK) {
      const existing = readApplications(userId);
      existing.push(application);
      localStorage.setItem(applicationsKey(userId), JSON.stringify(existing));
      return application;
    }
    // In real-auth mode the authoritative citizenId is the userId stored in
    // npis_session, not whatever the component passes in. Fall back to the
    // passed-in userId so the function still works in mock mode.
    let citizenId = application.userId;
    try {
      const raw = localStorage.getItem("npis_session");
      if (raw) {
        const parsed = JSON.parse(raw) as { userId?: string };
        if (parsed.userId) citizenId = parsed.userId;
      }
    } catch {
      // ignore — keep fallback
    }
    const response = await apiClient.post<{ application: unknown }>(
      "/applications",
      {
        citizenId,
        applicationType: frontendAppTypeToBackend(application.applicationType),
        validityId: application.passportValidity === 10 ? 2 : 1,
        serviceTypeId: 1,
        mukhtarFormData: {
          address: application.mukhtarFormData?.address ?? "",
          district: application.mukhtarFormData?.district ?? "",
          mukhtarName: application.mukhtarFormData?.mukhtarName ?? "",
        },
        // P4-F: pass through the citizen-selected mukhtar so the backend can
        // populate applications.assigned_mukhtar_id.
        assignedMukhtarId:
          application.mukhtarFormData?.selectedMukhtarId || null,
        identityDocumentType: application.identityDocumentType ?? null,
        documents: application.documents,
        biometricCaptured: application.biometricCaptured ?? false,
      },
    );
    return mapApiApplicationToFrontend(response.application);
  },

  // FR-10 — Update application status
  updateApplicationStatus: async (
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<void> => {
    if (USE_MOCK) {
      // Mock: scan all application buckets and update in-place
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith("applications_")) continue;
        try {
          const apps: PassportApplication[] = JSON.parse(
            localStorage.getItem(key) || "[]",
          );
          const idx = apps.findIndex((a) => a.applicationId === applicationId);
          if (idx >= 0) {
            apps[idx] = { ...apps[idx], currentStatus: status };
            localStorage.setItem(key, JSON.stringify(apps));
            break;
          }
        } catch {
          // skip malformed entries
        }
      }
      return;
    }
    await apiClient.put(`/applications/${applicationId}`, {
      currentStatus: frontendStatusToBackend(status),
    });
  },

  // FR-22 — Document resubmission; also resets status to PENDING_REVIEW
  updateApplicationDocuments: async (
    userId: string,
    applicationId: string,
    documents: PassportApplication["documents"],
  ): Promise<void> => {
    if (!USE_MOCK) {
      await apiClient.post(`/applications/${applicationId}/resubmit`, {
        citizenId: getSessionUserId() ?? userId,
        documents,
      });
      return;
    }

    const apps = readApplications(userId);
    const idx = apps.findIndex((a) => a.applicationId === applicationId);
    if (idx >= 0) {
      apps[idx] = {
        ...apps[idx],
        documents,
        currentStatus: "PENDING_REVIEW",
        // Clear stale rejection reasons — they referred to the previous upload
        resubmissionReasons: undefined,
        statusHistory: [
          ...(apps[idx].statusHistory ?? []),
          { status: "PENDING_REVIEW", timestamp: new Date().toISOString() },
        ],
      };
      localStorage.setItem(applicationsKey(userId), JSON.stringify(apps));
      // TODO: Remove when backend is connected — server creates this notification
      notificationService.create(userId, {
        userId,
        type: "STATUS_UPDATE",
        title: "Documents Resubmitted",
        message: `Your resubmitted documents for application ${apps[idx].trackingNumber} are now under review.`,
        applicationId,
      });
    }
  },

  // FR-10 — Get current status for any application (cross-user lookup for authorized roles)
  // TODO: GET /api/applications/:id/status when backend is ready
  getApplicationStatus: async (
    applicationId: string,
  ): Promise<ApplicationStatus | null> => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("applications_")) continue;
      try {
        const apps: PassportApplication[] = JSON.parse(
          localStorage.getItem(key) || "[]",
        );
        const found = apps.find((a) => a.applicationId === applicationId);
        if (found) return found.currentStatus;
      } catch {
        // skip malformed entries
      }
    }
    return null;
  },

  // Backward-compat alias — prefer getApplicationById for new code
  getApplication: (
    userId: string,
    applicationId: string,
  ): PassportApplication | null => {
    return (
      readApplications(userId).find((a) => a.applicationId === applicationId) ??
      null
    );
  },

  // Backward-compat alias — prefer createApplication for new code
  // TODO: Replace localStorage write with POST /api/applications when backend is ready
  saveApplication: (userId: string, application: PassportApplication): void => {
    const existing = readApplications(userId);
    const idx = existing.findIndex(
      (a) => a.applicationId === application.applicationId,
    );
    if (idx >= 0) {
      existing[idx] = application;
    } else {
      existing.push(application);
    }
    localStorage.setItem(applicationsKey(userId), JSON.stringify(existing));
  },

  // Backward-compat alias — prefer updateApplicationDocuments for new code
  // TODO: Replace localStorage update with PATCH /api/applications/:id when backend is ready
  updateApplication: (
    userId: string,
    applicationId: string,
    updates: Partial<PassportApplication>,
  ): void => {
    const apps = readApplications(userId);
    const idx = apps.findIndex((a) => a.applicationId === applicationId);
    if (idx >= 0) {
      apps[idx] = { ...apps[idx], ...updates };
      localStorage.setItem(applicationsKey(userId), JSON.stringify(apps));
    }
  },

  generateTrackingNumber: (): string => {
    const suffix = Math.floor(100000 + Math.random() * 900000);
    return `NPIS-2026-${suffix}`;
  },
};
