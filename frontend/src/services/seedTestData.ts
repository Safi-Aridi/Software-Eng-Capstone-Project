import type { StoredUser } from "./authService";

const USERS_KEY = "npis_users";
const kycStatusKey = (userId: string) => `kyc_status_${userId}`;
const identityDataKey = (userId: string) => `identity_data_${userId}`;

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

// Seeds exactly 3 test users if npis_users is empty or missing.
// Does NOT overwrite data on every reload.
export const seedTestDataIfNeeded = (): void => {
  const existing = localStorage.getItem(USERS_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length > 0) return;
    } catch {
      // fall through to seed
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
};
