import type { StoredUser } from "./authService";
import type { AuthorizedStoredUser } from "./authService";
import type { PassportApplication } from "./applicationService";

// =============================================================================
// Demo dataset (Session 15) — matches backend migration 009_reseed_all_data.sql
// UUIDs are 1:1 with the SQL migration so a user can flip
// VITE_USE_MOCK_AUTH / VITE_USE_MOCK_APPLICATIONS without losing their session.
// =============================================================================

const USERS_KEY = "npis_users";
const AUTHORIZED_USERS_KEY = "npis_authorized_users";
const kycStatusKey = (userId: string) => `kyc_status_${userId}`;
const identityDataKey = (userId: string) => `identity_data_${userId}`;
const applicationsKey = (userId: string) => `applications_${userId}`;
// passports_<userId> and notifications_<userId> are also cleared by
// clearAllSeededKeys() via prefix scan — no per-key helper needed here.

// ─── Citizen UUIDs (mirror migration 009) ─────────────────────────────────────

const CITIZEN_UUID = {
  safi:    "c1c1c1c1-0000-0000-0000-000000000001",
  mahmoud: "c1c1c1c1-0000-0000-0000-000000000002",
  jad:     "c1c1c1c1-0000-0000-0000-000000000003",
  yasser:  "c1c1c1c1-0000-0000-0000-000000000004",
  makram:  "c1c1c1c1-0000-0000-0000-000000000005",
  houssam: "c1c1c1c1-0000-0000-0000-000000000006",
  wael:    "c1c1c1c1-0000-0000-0000-000000000007",
  joel:    "c1c1c1c1-0000-0000-0000-000000000008",
  rena:    "c1c1c1c1-0000-0000-0000-000000000009",
  khaled:  "c1c1c1c1-0000-0000-0000-00000000000a",
} as const;

// ─── Mukhtar UUIDs (one per Lebanese district, mirror migration 009) ──────────

const MUKHTAR_DISTRICTS: ReadonlyArray<{ uuid: string; district: string }> = [
  { uuid: "bbbbbbbb-0000-0000-0000-000000000001", district: "Beirut" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000002", district: "Metn" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000003", district: "Baabda" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000004", district: "Aley" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000005", district: "Chouf" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000006", district: "Jbeil" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000007", district: "Kesrouan" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000008", district: "Batroun" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000009", district: "Koura" },
  { uuid: "bbbbbbbb-0000-0000-0000-00000000000a", district: "Zgharta" },
  { uuid: "bbbbbbbb-0000-0000-0000-00000000000b", district: "Bcharre" },
  { uuid: "bbbbbbbb-0000-0000-0000-00000000000c", district: "Tripoli" },
  { uuid: "bbbbbbbb-0000-0000-0000-00000000000d", district: "Miniyeh-Danniyeh" },
  { uuid: "bbbbbbbb-0000-0000-0000-00000000000e", district: "Akkar" },
  { uuid: "bbbbbbbb-0000-0000-0000-00000000000f", district: "Hermel" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000010", district: "Baalbek" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000011", district: "Zahle" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000012", district: "West Bekaa" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000013", district: "Rachaya" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000014", district: "Sidon" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000015", district: "Tyre" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000016", district: "Jezzine" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000017", district: "Nabatieh" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000018", district: "Bint Jbeil" },
  { uuid: "bbbbbbbb-0000-0000-0000-000000000019", district: "Hasbaya" },
  { uuid: "bbbbbbbb-0000-0000-0000-00000000001a", district: "Marjeyoun" },
];

const districtSlug = (d: string): string =>
  d.toLowerCase().replace(/\s+/g, "-");

// ─── Citizen test users (10) ──────────────────────────────────────────────────

interface CitizenSeed {
  userId: string;
  firstName: string;
  email: string;
  password: string;
  mobileNumber: string;
}

const CITIZEN_SEEDS: CitizenSeed[] = [
  { userId: CITIZEN_UUID.safi,    firstName: "Safi",    email: "safi@gmail.com",    password: "Safi123!",    mobileNumber: "70000001" },
  { userId: CITIZEN_UUID.mahmoud, firstName: "Mahmoud", email: "mahmoud@gmail.com", password: "Mahmoud123!", mobileNumber: "70000002" },
  { userId: CITIZEN_UUID.jad,     firstName: "Jad",     email: "jad@gmail.com",     password: "Jad123!",     mobileNumber: "70000003" },
  { userId: CITIZEN_UUID.yasser,  firstName: "Yasser",  email: "yasser@gmail.com",  password: "Yasser123!",  mobileNumber: "70000004" },
  { userId: CITIZEN_UUID.makram,  firstName: "Makram",  email: "makram@gmail.com",  password: "Makram123!",  mobileNumber: "70000005" },
  { userId: CITIZEN_UUID.houssam, firstName: "Houssam", email: "houssam@gmail.com", password: "Houssam123!", mobileNumber: "70000006" },
  { userId: CITIZEN_UUID.wael,    firstName: "Wael",    email: "wael@gmail.com",    password: "Wael123!",    mobileNumber: "70000007" },
  { userId: CITIZEN_UUID.joel,    firstName: "Joel",    email: "joel@gmail.com",    password: "Joel123!",    mobileNumber: "70000008" },
  { userId: CITIZEN_UUID.rena,    firstName: "Rena",    email: "rena@gmail.com",    password: "Rena123!",    mobileNumber: "70000009" },
  { userId: CITIZEN_UUID.khaled,  firstName: "Khaled",  email: "khaled@gmail.com",  password: "Khaled123!",  mobileNumber: "70000010" },
];

const TEST_USERS: StoredUser[] = CITIZEN_SEEDS.map((c) => ({
  userId: c.userId,
  email: c.email,
  password: c.password,
  fullName: `${c.firstName} Test`,
  mobileNumber: c.mobileNumber,
  failedLoginAttempts: 0,
  isLocked: false,
  lockedAt: null,
}));

// All seeded citizens have completed identity verification.
const KYC_STATUSES: Record<string, string> = Object.fromEntries(
  CITIZEN_SEEDS.map((c) => [c.userId, "IDENTITY_VERIFIED"]),
);

const IDENTITY_DATA: Record<string, object> = Object.fromEntries(
  CITIZEN_SEEDS.map((c, idx) => [
    c.userId,
    {
      fullName: `${c.firstName} Test`,
      registryNumber: `NR-${100000 + idx + 1}`,
      dateOfBirth: "1990-01-01",
    },
  ]),
);

// ─── Authorized users (26 mukhtars + 2 officers) ──────────────────────────────

const AUTHORIZED_USERS: AuthorizedStoredUser[] = [
  ...MUKHTAR_DISTRICTS.map<AuthorizedStoredUser>((m) => ({
    userId: m.uuid,
    email: `mukhtar.${districtSlug(m.district)}@gmail.com`,
    password: "Mukhtar123!",
    fullName: `Mukhtar ${m.district}`,
    role: "mukhtar",
  })),
  {
    userId: "0ff10ff1-0000-0000-0000-000000000001",
    email: "officer1@gmail.com",
    password: "Officer123!",
    fullName: "Officer One",
    role: "officer",
  },
  {
    userId: "0ff10ff1-0000-0000-0000-000000000002",
    email: "officer2@gmail.com",
    password: "Officer123!",
    fullName: "Officer Two",
    role: "officer",
  },
];

// ─── Applications for Safi + Jad (VERIFIED) ───────────────────────────────────

const SAFI_APPLICATION_ID = "a99a99a9-0000-0000-0000-000000000101";
const JAD_APPLICATION_ID  = "a99a99a9-0000-0000-0000-000000000102";

const BEIRUT_MUKHTAR = MUKHTAR_DISTRICTS[0]; // Beirut entry — mukhtar.beirut@gmail.com

const dayOffset = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const buildDemoApplications = (): { safi: PassportApplication[]; jad: PassportApplication[] } => {
  const sharedMukhtarForm = {
    address: "12 Hamra Street, Beirut",
    district: BEIRUT_MUKHTAR.district,
    mukhtarName: `Mukhtar ${BEIRUT_MUKHTAR.district}`,
    selectedMukhtarId: BEIRUT_MUKHTAR.uuid,
  };

  const sharedDocs = {
    frontUrl: "https://placeholder.test/id_front.jpg",
    backUrl: "https://placeholder.test/id_back.jpg",
    passportPhoto: "https://placeholder.test/passport_photo.jpg",
    oldPassport: null,
    identityDocument: null,
    civilRegistryExtract: null,
  };

  const safi: PassportApplication = {
    applicationId: SAFI_APPLICATION_ID,
    userId: CITIZEN_UUID.safi,
    applicationType: "NEW",
    currentStatus: "VERIFIED",
    submissionDate: dayOffset(3),
    trackingNumber: "NPIS-2026-000101",
    passportValidity: 5,
    feeAmount: 200_000,
    paymentStatus: "Paid",
    identityDocumentType: "NATIONAL_ID",
    documents: sharedDocs,
    mukhtarFormData: {
      ...sharedMukhtarForm,
      address: "12 Hamra Street, Beirut",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: dayOffset(3) },
      { status: "VERIFIED", timestamp: dayOffset(2) },
    ],
  };

  const jad: PassportApplication = {
    applicationId: JAD_APPLICATION_ID,
    userId: CITIZEN_UUID.jad,
    applicationType: "NEW",
    currentStatus: "VERIFIED",
    submissionDate: dayOffset(5),
    trackingNumber: "NPIS-2026-000102",
    passportValidity: 5,
    feeAmount: 200_000,
    paymentStatus: "Paid",
    identityDocumentType: "NATIONAL_ID",
    documents: sharedDocs,
    mukhtarFormData: {
      ...sharedMukhtarForm,
      address: "22 Verdun Road, Beirut",
    },
    biometricCaptured: true,
    statusHistory: [
      { status: "PENDING_REVIEW", timestamp: dayOffset(5) },
      { status: "VERIFIED", timestamp: dayOffset(4) },
    ],
  };

  return { safi: [safi], jad: [jad] };
};

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

// ─── Public entry point ───────────────────────────────────────────────────────

// Wipe every per-user / per-app localStorage key that the demo dataset owns.
// Used by both reseedTestData (DevStatusPanel) and any future "logout-all"
// flow. Whitespace-conservative: leaves session/token keys alone.
const clearAllSeededKeys = (): void => {
  const prefixesToClear = [
    "applications_",
    "passports_",
    "notifications_",
    "kyc_status_",
    "identity_data_",
    "mukhtar_signature_",
    "payment_",
    "expiry_banner_dismissed_",
  ];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (prefixesToClear.some((p) => k.startsWith(p))) {
      localStorage.removeItem(k);
    }
  }
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(AUTHORIZED_USERS_KEY);
};

// Force clears all demo data then re-seeds — for DevStatusPanel use.
export const reseedTestData = (): void => {
  clearAllSeededKeys();
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

  // Seed authorized users (mukhtars + officers) — idempotent
  const existingAuth = localStorage.getItem(AUTHORIZED_USERS_KEY);
  if (!existingAuth || JSON.parse(existingAuth).length === 0) {
    localStorage.setItem(
      AUTHORIZED_USERS_KEY,
      JSON.stringify(AUTHORIZED_USERS),
    );
  }

  // Skip seeding application/passport mock data when the applications
  // service is wired to the real backend — otherwise the dashboard would
  // mix Supabase rows with stale localStorage entries.
  if (import.meta.env.VITE_USE_MOCK_APPLICATIONS === "false") {
    return;
  }

  const apps = buildDemoApplications();
  ensureApplicationsExist(CITIZEN_UUID.safi, apps.safi);
  ensureApplicationsExist(CITIZEN_UUID.jad, apps.jad);
};

