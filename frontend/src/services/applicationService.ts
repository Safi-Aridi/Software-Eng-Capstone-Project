import { notificationService } from "./notificationService";

export type ApplicationType = "NEW" | "RENEWAL";

export type ApplicationStatus =
  | "PENDING_REVIEW"
  | "VERIFIED"
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
  documents: {
    identityDocument: string | null;
    passportPhoto: string | null;
    oldPassport: string | null;
  };
  mukhtarFormData: {
    address: string;
    district: string;
    mukhtarName: string;
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

const applicationsKey = (userId: string) => `applications_${userId}`;

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
  // TODO: GET /api/applications?role=citizen when backend is ready
  getApplications: async (userId: string): Promise<PassportApplication[]> => {
    return readApplications(userId);
  },

  // FR-10 — Get single application by ID
  // TODO: GET /api/applications/:id when backend is ready
  getApplicationById: async (
    userId: string,
    applicationId: string,
  ): Promise<PassportApplication | null> => {
    return (
      readApplications(userId).find((a) => a.applicationId === applicationId) ??
      null
    );
  },

  // FR-06, FR-08 — Submit new passport application
  // TODO: POST /api/applications when backend is ready
  createApplication: async (
    userId: string,
    application: PassportApplication,
  ): Promise<PassportApplication> => {
    const existing = readApplications(userId);
    existing.push(application);
    localStorage.setItem(applicationsKey(userId), JSON.stringify(existing));
    return application;
  },

  // FR-22 — Document resubmission; also resets status to PENDING_REVIEW
  // TODO: PUT /api/applications/:id/documents when backend is ready
  updateApplicationDocuments: async (
    userId: string,
    applicationId: string,
    documents: PassportApplication["documents"],
  ): Promise<void> => {
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
