export type ApplicationType = "NEW" | "RENEWAL";

export type ApplicationStatus =
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "MUKHTAR_SIGNED"
  | "PROCESSED"
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
  statusHistory?: StatusHistoryEntry[];
}

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
        statusHistory: [
          ...(apps[idx].statusHistory ?? []),
          { status: "PENDING_REVIEW", timestamp: new Date().toISOString() },
        ],
      };
      localStorage.setItem(applicationsKey(userId), JSON.stringify(apps));
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
