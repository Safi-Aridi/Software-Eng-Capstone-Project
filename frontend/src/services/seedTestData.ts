import type { StoredUser } from "./authService";
import type { PassportApplication } from "./applicationService";

const USERS_KEY = "npis_users";
const kycStatusKey = (userId: string) => `kyc_status_${userId}`;
const identityDataKey = (userId: string) => `identity_data_${userId}`;
const applicationsKey = (userId: string) => `applications_${userId}`;

const TEST_USERS: StoredUser[] = [
  {
    userId: "user_001",
    email: "pending@test.com",
    password: "test123",
    fullName: "Ahmad Khalil",
    mobileNumber: "70123456",
  },
  {
    userId: "user_002",
    email: "accepted@test.com",
    password: "test123",
    fullName: "Sara Mansour",
    mobileNumber: "71234567",
  },
  {
    userId: "user_003",
    email: "rejected@test.com",
    password: "test123",
    fullName: "Omar Fayyad",
    mobileNumber: "76543210",
  },
];

const KYC_STATUSES: Record<string, string> = {
  user_001: "PENDING_IDENTITY_VERIFICATION",
  user_002: "IDENTITY_VERIFIED",
  user_003: "IDENTITY_REJECTED",
};

const IDENTITY_DATA: Record<string, object> = {
  user_001: {
    fullName: "Ahmad Khalil",
    registryNumber: "12345",
    dateOfBirth: "1990-05-15",
  },
  user_002: {
    fullName: "Sara Mansour",
    registryNumber: "67890",
    dateOfBirth: "1995-11-22",
  },
  user_003: {
    fullName: "Omar Fayyad",
    registryNumber: "11223",
    dateOfBirth: "1988-03-30",
  },
};

// Dates relative to 2026-04-30
const APPS_USER_002: PassportApplication[] = [
  {
    applicationId: "app_seed_002_001",
    userId: "user_002",
    applicationType: "NEW",
    currentStatus: "MUKHTAR_SIGNED",
    submissionDate: "2026-04-20T09:00:00.000Z", // 10 days ago
    trackingNumber: "NPIS-2026-000001",
    passportValidity: 10,
    feeAmount: 350_000,
    documents: {
      identityDocument: "national_id.pdf",
      passportPhoto: "photo.jpg",
      oldPassport: null,
    },
    mukhtarFormData: {
      address: "12 Hamra Street, Beirut",
      district: "Beirut",
      mukhtarName: "Mukhtar Hassan Al-Amin",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-20T09:00:00.000Z" },
      { status: "VERIFIED", timestamp: "2026-04-22T11:30:00.000Z" },
      { status: "MUKHTAR_SIGNED", timestamp: "2026-04-25T14:00:00.000Z" },
    ],
  },
  {
    applicationId: "app_seed_002_002",
    userId: "user_002",
    applicationType: "RENEWAL",
    currentStatus: "PENDING_REVIEW",
    submissionDate: "2026-04-28T10:00:00.000Z", // 2 days ago
    trackingNumber: "NPIS-2026-000002",
    passportValidity: 5,
    feeAmount: 200_000,
    documents: {
      identityDocument: "national_id.pdf",
      passportPhoto: "photo.jpg",
      oldPassport: "old_passport_scan.pdf",
    },
    mukhtarFormData: {
      address: "12 Hamra Street, Beirut",
      district: "Beirut",
      mukhtarName: "Mukhtar Hassan Al-Amin",
    },
    biometricCaptured: false,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-28T10:00:00.000Z" },
    ],
  },
];

const APPS_USER_001: PassportApplication[] = [
  {
    applicationId: "app_seed_001_001",
    userId: "user_001",
    applicationType: "NEW",
    currentStatus: "RESUBMISSION_REQUIRED",
    submissionDate: "2026-04-23T08:00:00.000Z", // 7 days ago
    trackingNumber: "NPIS-2026-000003",
    passportValidity: 5,
    feeAmount: 200_000,
    documents: {
      identityDocument: "id_blurry.jpg",
      passportPhoto: "photo.png",
      oldPassport: null,
    },
    mukhtarFormData: {
      address: "5 Verdun Road, Beirut",
      district: "Baabda",
      mukhtarName: "Mukhtar Karim Nassar",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-23T08:00:00.000Z" },
      {
        status: "RESUBMISSION_REQUIRED",
        timestamp: "2026-04-25T16:00:00.000Z",
      },
    ],
  },
];

// Seeds exactly 3 test users if npis_users is empty or missing.
// Does NOT overwrite data on every reload.
export const seedTestDataIfNeeded = (): void => {
  const existing = localStorage.getItem(USERS_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Users already seeded — seed applications if missing
        seedApplicationsIfNeeded();
        return;
      }
    } catch {
      // fall through to full reseed
    }
  }

  localStorage.setItem(USERS_KEY, JSON.stringify(TEST_USERS));

  for (const user of TEST_USERS) {
    localStorage.setItem(kycStatusKey(user.userId), KYC_STATUSES[user.userId]);
    localStorage.setItem(
      identityDataKey(user.userId),
      JSON.stringify(IDENTITY_DATA[user.userId]),
    );
  }

  seedApplicationsIfNeeded();
};

// Seed mock applications only if not already present for each user.
const seedApplicationsIfNeeded = (): void => {
  if (!localStorage.getItem(applicationsKey("user_002"))) {
    localStorage.setItem(
      applicationsKey("user_002"),
      JSON.stringify(APPS_USER_002),
    );
  }
  if (!localStorage.getItem(applicationsKey("user_001"))) {
    localStorage.setItem(
      applicationsKey("user_001"),
      JSON.stringify(APPS_USER_001),
    );
  }
};
