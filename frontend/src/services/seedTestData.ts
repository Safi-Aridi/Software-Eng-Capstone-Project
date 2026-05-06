import type { StoredUser } from "./authService";
import type { AuthorizedStoredUser } from "./authService";
import type { PassportApplication } from "./applicationService";

const USERS_KEY = "npis_users";
const AUTHORIZED_USERS_KEY = "npis_authorized_users";
const kycStatusKey = (userId: string) => `kyc_status_${userId}`;
const identityDataKey = (userId: string) => `identity_data_${userId}`;
const applicationsKey = (userId: string) => `applications_${userId}`;
const signatureKey = (applicationId: string) =>
  `mukhtar_signature_${applicationId}`;

// ─── Citizen test users ───────────────────────────────────────────────────────

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

// ─── Authorized test users (Mukhtar + Officer) ────────────────────────────────

const AUTHORIZED_USERS: AuthorizedStoredUser[] = [
  {
    userId: "mukhtar_001",
    email: "mukhtar@test.com",
    password: "test123",
    fullName: "Khalil Raad",
    role: "mukhtar",
  },
  {
    userId: "officer_001",
    email: "officer@test.com",
    password: "test123",
    fullName: "Rima Sleiman",
    role: "officer",
  },
];

// ─── Applications (relative to 2026-04-30) ───────────────────────────────────

const APPS_USER_002: PassportApplication[] = [
  {
    applicationId: "app_seed_002_001",
    userId: "user_002",
    applicationType: "NEW",
    currentStatus: "MUKHTAR_SIGNED",
    submissionDate: "2026-04-20T09:00:00.000Z",
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
      mukhtarName: "Khalil Raad",
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
    submissionDate: "2026-04-28T10:00:00.000Z",
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
      mukhtarName: "Khalil Raad",
    },
    biometricCaptured: false,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-28T10:00:00.000Z" },
    ],
  },
  // ── VERIFIED apps for mukhtar queue ──────────────────────────────────────
  {
    applicationId: "app_seed_verified_001",
    userId: "user_002",
    applicationType: "NEW",
    currentStatus: "VERIFIED",
    submissionDate: "2026-04-15T08:00:00.000Z",
    trackingNumber: "NPIS-2026-100001",
    passportValidity: 10,
    feeAmount: 350_000,
    documents: {
      identityDocument: "national_id.pdf",
      passportPhoto: "photo.jpg",
      oldPassport: null,
    },
    mukhtarFormData: {
      address: "15 Hamra Street, Beirut",
      district: "Beirut",
      mukhtarName: "Khalil Raad",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-15T08:00:00.000Z" },
      { status: "VERIFIED", timestamp: "2026-04-17T10:00:00.000Z" },
    ],
  },
  {
    applicationId: "app_seed_verified_002",
    userId: "user_002",
    applicationType: "RENEWAL",
    currentStatus: "VERIFIED",
    submissionDate: "2026-04-16T11:00:00.000Z",
    trackingNumber: "NPIS-2026-100002",
    passportValidity: 5,
    feeAmount: 200_000,
    documents: {
      identityDocument: "national_id.pdf",
      passportPhoto: "photo.jpg",
      oldPassport: "old_passport.pdf",
    },
    mukhtarFormData: {
      address: "8 Al-Mina Road, Tripoli",
      district: "Tripoli",
      mukhtarName: "Khalil Raad",
    },
    biometricCaptured: false,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-16T11:00:00.000Z" },
      { status: "VERIFIED", timestamp: "2026-04-18T09:00:00.000Z" },
    ],
  },
  {
    applicationId: "app_seed_verified_003",
    userId: "user_002",
    applicationType: "NEW",
    currentStatus: "VERIFIED",
    submissionDate: "2026-04-17T14:00:00.000Z",
    trackingNumber: "NPIS-2026-100003",
    passportValidity: 10,
    feeAmount: 350_000,
    documents: {
      identityDocument: "id_card.jpg",
      passportPhoto: "portrait.jpg",
      oldPassport: null,
    },
    mukhtarFormData: {
      address: "3 Riad Al-Solh Street, Sidon",
      district: "Sidon",
      mukhtarName: "Khalil Raad",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-17T14:00:00.000Z" },
      { status: "VERIFIED", timestamp: "2026-04-19T11:00:00.000Z" },
    ],
  },
  // ── MUKHTAR_SIGNED apps for officer queue ─────────────────────────────────
  {
    applicationId: "app_seed_signed_001",
    userId: "user_002",
    applicationType: "NEW",
    currentStatus: "MUKHTAR_SIGNED",
    submissionDate: "2026-04-10T09:00:00.000Z",
    trackingNumber: "NPIS-2026-200001",
    passportValidity: 10,
    feeAmount: 350_000,
    documents: {
      identityDocument: "national_id.pdf",
      passportPhoto: "photo.jpg",
      oldPassport: null,
    },
    mukhtarFormData: {
      address: "22 Verdun Road, Beirut",
      district: "Beirut",
      mukhtarName: "Khalil Raad",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-10T09:00:00.000Z" },
      { status: "VERIFIED", timestamp: "2026-04-12T10:00:00.000Z" },
      { status: "MUKHTAR_SIGNED", timestamp: "2026-04-14T13:00:00.000Z" },
    ],
  },
  {
    applicationId: "app_seed_signed_002",
    userId: "user_002",
    applicationType: "RENEWAL",
    currentStatus: "MUKHTAR_SIGNED",
    submissionDate: "2026-04-11T10:30:00.000Z",
    trackingNumber: "NPIS-2026-200002",
    passportValidity: 5,
    feeAmount: 200_000,
    documents: {
      identityDocument: "national_id.pdf",
      passportPhoto: "photo.jpg",
      oldPassport: "old_passport.pdf",
    },
    mukhtarFormData: {
      address: "7 Jdeideh Avenue, Beirut",
      district: "Metn",
      mukhtarName: "Khalil Raad",
    },
    biometricCaptured: false,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-11T10:30:00.000Z" },
      { status: "VERIFIED", timestamp: "2026-04-13T11:00:00.000Z" },
      { status: "MUKHTAR_SIGNED", timestamp: "2026-04-15T15:00:00.000Z" },
    ],
  },
];

const APPS_USER_001: PassportApplication[] = [
  {
    applicationId: "app_seed_001_001",
    userId: "user_001",
    applicationType: "NEW",
    currentStatus: "RESUBMISSION_REQUIRED",
    submissionDate: "2026-04-23T08:00:00.000Z",
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
      mukhtarName: "Khalil Raad",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: "2026-04-23T08:00:00.000Z" },
      { status: "RESUBMISSION_REQUIRED", timestamp: "2026-04-25T16:00:00.000Z" },
    ],
  },
];

// Mock mukhtar signatures for the pre-seeded MUKHTAR_SIGNED applications
const SEED_SIGNATURES: Record<string, object> = {
  "app_seed_002_001": {
    signatureId: "sig_app_seed_002_001_seed",
    algorithm: "RSA-SHA256",
    timestamp: "2026-04-25T14:00:00.000Z",
    signedBy: "mukhtar_001",
    digest: "mock-digest-a1b2c3d4e5f6",
  },
  "app_seed_signed_001": {
    signatureId: "sig_app_seed_signed_001_seed",
    algorithm: "RSA-SHA256",
    timestamp: "2026-04-14T13:00:00.000Z",
    signedBy: "mukhtar_001",
    digest: "mock-digest-f6e5d4c3b2a1",
  },
  "app_seed_signed_002": {
    signatureId: "sig_app_seed_signed_002_seed",
    algorithm: "RSA-SHA256",
    timestamp: "2026-04-15T15:00:00.000Z",
    signedBy: "mukhtar_001",
    digest: "mock-digest-1a2b3c4d5e6f",
  },
};

// ─── Near-expiry DELIVERED apps for user_002 (built dynamically relative to today) ──

const buildExpiryDemoApps = (): PassportApplication[] => {
  const now = Date.now();
  const yearMs = 1000 * 60 * 60 * 24 * 365;
  const monthMs = 1000 * 60 * 60 * 24 * 30;

  // Info-tier: ~6 months until expiry → 5y validity, delivered ~4y6m ago
  const infoDelivered = new Date(now - (4.5 * yearMs)).toISOString();
  // Warning-tier: ~2 months until expiry → 5y validity, delivered ~4y10m ago
  const warningDelivered = new Date(now - (4 * yearMs + 10 * monthMs)).toISOString();
  // Critical/Expired: already expired ~1 month ago → 5y validity, delivered ~5y1m ago
  const expiredDelivered = new Date(now - (5 * yearMs + monthMs)).toISOString();

  const baseDocs = {
    identityDocument: "national_id.pdf",
    passportPhoto: "photo.jpg",
    oldPassport: null,
  };
  const baseMukhtarForm = {
    address: "12 Hamra Street, Beirut",
    district: "Beirut",
    mukhtarName: "Khalil Raad",
  };

  return [
    {
      applicationId: "app_seed_002_expiry_info",
      userId: "user_002",
      applicationType: "NEW",
      currentStatus: "DELIVERED",
      submissionDate: new Date(now - (4.5 * yearMs + monthMs)).toISOString(),
      trackingNumber: "NPIS-2021-700001",
      passportValidity: 5,
      feeAmount: 200_000,
      paymentStatus: "Paid",
      documents: baseDocs,
      mukhtarFormData: baseMukhtarForm,
      biometricCaptured: true,
      deliveredDate: infoDelivered,
      statusHistory: [
        { status: "DELIVERED", timestamp: infoDelivered },
      ],
    },
    {
      applicationId: "app_seed_002_expiry_warning",
      userId: "user_002",
      applicationType: "NEW",
      currentStatus: "DELIVERED",
      submissionDate: new Date(now - (4 * yearMs + 11 * monthMs)).toISOString(),
      trackingNumber: "NPIS-2021-700002",
      passportValidity: 5,
      feeAmount: 200_000,
      paymentStatus: "Paid",
      documents: baseDocs,
      mukhtarFormData: baseMukhtarForm,
      biometricCaptured: true,
      deliveredDate: warningDelivered,
      statusHistory: [
        { status: "DELIVERED", timestamp: warningDelivered },
      ],
    },
    {
      applicationId: "app_seed_002_expiry_expired",
      userId: "user_002",
      applicationType: "NEW",
      currentStatus: "DELIVERED",
      submissionDate: new Date(now - (5 * yearMs + 2 * monthMs)).toISOString(),
      trackingNumber: "NPIS-2020-700003",
      passportValidity: 5,
      feeAmount: 200_000,
      paymentStatus: "Paid",
      documents: baseDocs,
      mukhtarFormData: baseMukhtarForm,
      biometricCaptured: true,
      deliveredDate: expiredDelivered,
      statusHistory: [
        { status: "DELIVERED", timestamp: expiredDelivered },
      ],
    },
  ];
};

// ─── UNPAID app — built dynamically so submissionDate is always 25 min in the past ──

const buildUnpaidApp = (): PassportApplication => ({
  applicationId: "app_seed_002_unpaid",
  userId: "user_002",
  applicationType: "NEW",
  currentStatus: "PENDING_REVIEW",
  submissionDate: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  trackingNumber: "NPIS-2026-000004",
  passportValidity: 5,
  feeAmount: 200_000,
  paymentStatus: "UNPAID",
  documents: {
    identityDocument: "national_id.pdf",
    passportPhoto: "photo.jpg",
    oldPassport: null,
  },
  mukhtarFormData: {
    address: "10 Bliss Street, Hamra",
    district: "Beirut",
    mukhtarName: "Khalil Raad",
  },
  biometricCaptured: true,
  statusHistory: [
    {
      status: "PENDING_REVIEW",
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
  ],
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

// Merges apps into storage by ID — never overwrites existing entries
const ensureApplicationsExist = (
  userId: string,
  apps: PassportApplication[],
): void => {
  const stored: PassportApplication[] = JSON.parse(
    localStorage.getItem(applicationsKey(userId)) || "[]",
  );
  const existingIds = new Set(stored.map((a) => a.applicationId));
  const toAdd = apps.filter((a) => !existingIds.has(a.applicationId));
  if (toAdd.length > 0) {
    localStorage.setItem(
      applicationsKey(userId),
      JSON.stringify([...stored, ...toAdd]),
    );
  }
};

const seedSignaturesIfNeeded = (): void => {
  for (const [applicationId, sig] of Object.entries(SEED_SIGNATURES)) {
    const key = signatureKey(applicationId);
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(sig));
    }
  }
};

// ─── Public entry point ───────────────────────────────────────────────────────

// Force clears all application data then re-seeds — for DevStatusPanel use.
export const reseedTestData = (): void => {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith("applications_")) localStorage.removeItem(k);
  }
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(AUTHORIZED_USERS_KEY);
  seedTestDataIfNeeded();
};

// Seeds all test data into localStorage on first load (no-op if already seeded).
export const seedTestDataIfNeeded = (): void => {
  // Seed citizen users
  const existing = localStorage.getItem(USERS_KEY);
  if (!existing || JSON.parse(existing).length === 0) {
    localStorage.setItem(USERS_KEY, JSON.stringify(TEST_USERS));
    for (const user of TEST_USERS) {
      localStorage.setItem(kycStatusKey(user.userId), KYC_STATUSES[user.userId]);
      localStorage.setItem(
        identityDataKey(user.userId),
        JSON.stringify(IDENTITY_DATA[user.userId]),
      );
    }
  }

  // Seed authorized users (mukhtar + officer) — idempotent
  const existingAuth = localStorage.getItem(AUTHORIZED_USERS_KEY);
  if (!existingAuth || JSON.parse(existingAuth).length === 0) {
    localStorage.setItem(AUTHORIZED_USERS_KEY, JSON.stringify(AUTHORIZED_USERS));
  }

  // Seed applications by ID — safe to call every load
  ensureApplicationsExist("user_002", [
    ...APPS_USER_002,
    buildUnpaidApp(),
    ...buildExpiryDemoApps(),
  ]);
  ensureApplicationsExist("user_001", APPS_USER_001);

  // Seed mukhtar signatures for pre-signed applications
  seedSignaturesIfNeeded();
};
