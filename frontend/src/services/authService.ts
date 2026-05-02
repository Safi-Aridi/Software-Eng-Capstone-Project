export type UserRole = "citizen" | "mukhtar" | "officer";

export type AccountStatus =
  | "NO_IDENTITY_VERIFICATION"
  | "PENDING_IDENTITY_VERIFICATION"
  | "IDENTITY_VERIFICATION_REJECTED"
  | "ACTIVE"
  | "LOCKED";

// Persisted record in the npis_users array
export interface StoredUser {
  userId: string;
  email: string;
  password: string;
  fullName: string;
  mobileNumber: string;
  // FR-05.1 — single source of truth for failed-attempt + lock state
  failedLoginAttempts?: number;
  isLocked?: boolean;
  lockedAt?: number | null;
}

export interface LoginResult {
  success: boolean;
  message: string;
  failedAttempts: number;
  remainingAttempts: number;
  isLocked: boolean;
  lockedUserId?: string;
  user?: MockUser;
}

export interface MockUser {
  token: string;
  role: UserRole;
  accountStatus: AccountStatus;
  user: {
    id: string;
    fullName: string;
    mobileNumber?: string;
    email?: string;
  };
  kycIssueDescription?: string;
}

export interface AuthorizedStoredUser {
  userId: string;
  email: string;
  password: string;
  fullName: string;
  role: "mukhtar" | "officer";
}

const SESSION_KEY = "npis_user";
const USERS_KEY = "npis_users";
const AUTHORIZED_USERS_KEY = "npis_authorized_users";

// FR-05.1 — account lockout after 3 failed login attempts; auto-unlock after 15 minutes
const LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 3;

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;
const otpKey = (mobile: string) => `otp_${mobile}`;

interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const readOtp = (mobile: string): OtpRecord | null => {
  const raw = localStorage.getItem(otpKey(mobile));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtpRecord;
  } catch {
    return null;
  }
};

const writeOtp = (mobile: string, record: OtpRecord): void => {
  localStorage.setItem(otpKey(mobile), JSON.stringify(record));
};

export type OtpResult = "SUCCESS" | "INVALID" | "EXPIRED" | "LOCKED";

const getAuthorizedUsers = (): AuthorizedStoredUser[] => {
  try {
    return JSON.parse(localStorage.getItem(AUTHORIZED_USERS_KEY) || "[]");
  } catch {
    return [];
  }
};

const kycStatusKey = (userId: string) => `kyc_status_${userId}`;
const identityDataKey = (userId: string) => `identity_data_${userId}`;

// Maps raw kycStatus strings (including seed-specific variants) to AccountStatus
const resolveAccountStatus = (raw: string): AccountStatus => {
  switch (raw) {
    case "IDENTITY_VERIFIED":
      return "ACTIVE";
    case "IDENTITY_REJECTED":
      return "IDENTITY_VERIFICATION_REJECTED";
    case "NO_IDENTITY_VERIFICATION":
    case "PENDING_IDENTITY_VERIFICATION":
    case "IDENTITY_VERIFICATION_REJECTED":
    case "ACTIVE":
    case "LOCKED":
      return raw as AccountStatus;
    default:
      return "NO_IDENTITY_VERIFICATION";
  }
};

const getUsers = (): StoredUser[] => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
};

// Persists a single mutated user back into the npis_users array.
// All lock/failed-attempt state lives on the user record itself, so this
// is the single write path for that state.
const writeUser = (updated: StoredUser): void => {
  const users = getUsers();
  const idx = users.findIndex((u) => u.userId === updated.userId);
  if (idx < 0) return;
  users[idx] = updated;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// Returns true if the user's lock has expired (15 minutes since lockedAt).
// Pure check — does not mutate.
const lockHasExpired = (user: StoredUser): boolean => {
  if (!user.isLocked || !user.lockedAt) return false;
  return Date.now() - user.lockedAt >= LOCK_DURATION_MS;
};

export const authService = {
  // FR-02 — Citizen login
  // TODO: return apiClient.post('/auth/login', { identifier, password });
  login: async (
    identifier: string,
    password: string,
  ): Promise<LoginResult> => {
    return authService.loginCitizen(identifier, password);
  },

  // FR-03 — Citizen registration
  // TODO: return apiClient.post('/auth/register', data);
  register: async (data: {
    mobileNumber: string;
    email: string;
    password: string;
    fullName?: string;
  }): Promise<MockUser> => {
    return authService.registerCitizen(data);
  },

  // Returns the role of the currently authenticated user in uppercase, matching backend convention
  getUserRole: (): "CITIZEN" | "MUKHTAR" | "OFFICER" | null => {
    const user = authService.getCurrentUser();
    if (!user) return null;
    switch (user.role) {
      case "citizen":
        return "CITIZEN";
      case "mukhtar":
        return "MUKHTAR";
      case "officer":
        return "OFFICER";
      default:
        return null;
    }
  },

  loginCitizen: (identifier: string, password: string): LoginResult => {
    if (!identifier || !password) {
      return {
        success: false,
        message: "Mobile number/email and password are required",
        failedAttempts: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
        isLocked: false,
      };
    }

    const users = getUsers();
    const matched = users.find(
      (u) => u.email === identifier || u.mobileNumber === identifier,
    );

    if (!matched) {
      return {
        success: false,
        message:
          "Invalid credentials. Please check your mobile number/email and password.",
        failedAttempts: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
        isLocked: false,
      };
    }

    // FR-05.1 — auto-unlock if the 15-minute window has elapsed
    if (matched.isLocked && lockHasExpired(matched)) {
      matched.isLocked = false;
      matched.lockedAt = null;
      matched.failedLoginAttempts = 0;
      writeUser(matched);
    }

    // FR-05.1 — short-circuit if still locked, regardless of password
    if (matched.isLocked) {
      return {
        success: false,
        message: "Your account is locked.",
        failedAttempts: matched.failedLoginAttempts ?? MAX_LOGIN_ATTEMPTS,
        remainingAttempts: 0,
        isLocked: true,
        lockedUserId: matched.userId,
      };
    }

    if (matched.password !== password) {
      const next = (matched.failedLoginAttempts ?? 0) + 1;
      matched.failedLoginAttempts = next;
      if (next >= MAX_LOGIN_ATTEMPTS) {
        matched.isLocked = true;
        matched.lockedAt = Date.now();
      }
      writeUser(matched);

      if (matched.isLocked) {
        return {
          success: false,
          message: "Too many failed attempts. Your account has been locked.",
          failedAttempts: next,
          remainingAttempts: 0,
          isLocked: true,
          lockedUserId: matched.userId,
        };
      }
      const remaining = MAX_LOGIN_ATTEMPTS - next;
      return {
        success: false,
        message: `Invalid credentials. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before your account is locked.`,
        failedAttempts: next,
        remainingAttempts: remaining,
        isLocked: false,
      };
    }

    // Success — reset failed-attempt counter on the user record
    matched.failedLoginAttempts = 0;
    matched.lockedAt = null;
    writeUser(matched);

    const rawStatus =
      localStorage.getItem(kycStatusKey(matched.userId)) ||
      "NO_IDENTITY_VERIFICATION";
    const accountStatus = resolveAccountStatus(rawStatus);

    const mockUser: MockUser = {
      token: "mock-citizen-token-" + Date.now(),
      role: "citizen",
      accountStatus,
      user: {
        id: matched.userId,
        fullName: matched.fullName,
        mobileNumber: matched.mobileNumber,
        email: matched.email,
      },
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
    return {
      success: true,
      message: "Login successful",
      failedAttempts: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      isLocked: false,
      user: mockUser,
    };
  },

  registerCitizen: (data: {
    mobileNumber: string;
    email: string;
    password: string;
    fullName?: string;
  }): MockUser => {
    const users = getUsers();

    const existing = users.find(
      (u) => u.email === data.email || u.mobileNumber === data.mobileNumber,
    );
    if (existing) {
      throw new Error(
        "An account with this email or mobile number already exists.",
      );
    }

    const userId = "user_" + Date.now();
    const newUser: StoredUser = {
      userId,
      email: data.email,
      password: data.password,
      fullName: data.fullName || "",
      mobileNumber: data.mobileNumber,
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(kycStatusKey(userId), "NO_IDENTITY_VERIFICATION");

    const mockUser: MockUser = {
      token: "mock-citizen-token-" + Date.now(),
      role: "citizen",
      accountStatus: "NO_IDENTITY_VERIFICATION",
      user: {
        id: userId,
        fullName: newUser.fullName,
        mobileNumber: newUser.mobileNumber,
        email: newUser.email,
      },
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
    return mockUser;
  },

  loginAuthorized: (identifier: string, password: string): MockUser => {
    if (!identifier || !password) {
      throw new Error("Authorized ID/email and password are required");
    }

    const users = getAuthorizedUsers();
    const found = users.find(
      (u) => u.email === identifier && u.password === password,
    );

    if (!found) {
      throw new Error(
        "Invalid credentials. Please check your email and password.",
      );
    }

    const mockUser: MockUser = {
      token: `mock-${found.role}-token-` + Date.now(),
      role: found.role,
      accountStatus: "ACTIVE",
      user: {
        id: found.userId,
        fullName: found.fullName,
        email: found.email,
      },
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
    return mockUser;
  },

  getCurrentUser: (): MockUser | null => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  // Only removes the active session — other users' scoped data is preserved
  logout: (): void => {
    localStorage.removeItem(SESSION_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!authService.getCurrentUser();
  },

  updateAccountStatus: (
    status: AccountStatus,
    identityVerificationIssueDescription?: string,
  ): void => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const userId = currentUser.user.id;
    localStorage.setItem(kycStatusKey(userId), status);

    const updatedUser: MockUser = {
      ...currentUser,
      accountStatus: status,
      ...(identityVerificationIssueDescription && {
        kycIssueDescription: identityVerificationIssueDescription,
      }),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
  },

  updateKycData: (identityData: {
    fullName: string;
    registryNumber: string;
    dob: string;
    documentType: string;
  }): void => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const userId = currentUser.user.id;

    const users = getUsers();
    const idx = users.findIndex((u) => u.userId === userId);
    if (idx >= 0) {
      users[idx].fullName = identityData.fullName;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    localStorage.setItem(identityDataKey(userId), JSON.stringify(identityData));

    const updatedUser: MockUser = {
      ...currentUser,
      user: { ...currentUser.user, fullName: identityData.fullName },
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
  },

  saveIdentityData: (identityData: unknown): void => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;
    localStorage.setItem(
      identityDataKey(currentUser.user.id),
      JSON.stringify(identityData),
    );
  },

  getSavedIdentityData: (): Record<string, unknown> | null => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return null;
    const saved = localStorage.getItem(identityDataKey(currentUser.user.id));
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  },

  getIdentityData: (): Record<string, unknown> | null => {
    return authService.getSavedIdentityData();
  },

  // FR-02 — Generate a 6-digit OTP for the given mobile number
  // TODO: Replace with POST /api/otp/send — triggers real SMS via gateway
  generateOtp: (mobile: string): string => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    writeOtp(mobile, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });
    console.log(`[DEV] OTP for ${mobile}: ${code}`);
    return code;
  },

  // FR-02 — Validate an entered OTP for the given mobile number
  // TODO: Replace with POST /api/otp/validate
  validateOtp: (mobile: string, entered: string): OtpResult => {
    const record = readOtp(mobile);
    if (!record) return "EXPIRED";

    if (record.attempts >= OTP_MAX_ATTEMPTS) return "LOCKED";
    if (Date.now() > record.expiresAt) return "EXPIRED";

    if (record.code !== entered) {
      const updated: OtpRecord = { ...record, attempts: record.attempts + 1 };
      writeOtp(mobile, updated);
      if (updated.attempts >= OTP_MAX_ATTEMPTS) return "LOCKED";
      return "INVALID";
    }

    localStorage.removeItem(otpKey(mobile));
    return "SUCCESS";
  },

  getOtpAttempts: (mobile: string): number => {
    return readOtp(mobile)?.attempts ?? 0;
  },

  clearOtp: (mobile: string): void => {
    localStorage.removeItem(otpKey(mobile));
  },

  // FR-05.1 — Lock the account on the user record itself
  // TODO: POST /api/auth/lock — backend will own the lock state
  lockAccount: (userId: string): void => {
    const user = getUsers().find((u) => u.userId === userId);
    if (!user) return;
    user.isLocked = true;
    user.lockedAt = Date.now();
    user.failedLoginAttempts = MAX_LOGIN_ATTEMPTS;
    writeUser(user);
  },

  // True if user.isLocked is set and the 15-minute window has not yet elapsed.
  // Auto-unlocks on read only when an existing lock has expired — never
  // touches counters for users that aren't locked.
  isAccountLocked: (userId: string): boolean => {
    const user = getUsers().find((u) => u.userId === userId);
    if (!user || !user.isLocked) return false;
    if (lockHasExpired(user)) {
      authService.unlockAccount(userId);
      return false;
    }
    return true;
  },

  // FR-05.1 — Returns remaining lock time in milliseconds, or 0 if not locked
  getRemainingLockTime: (userId: string): number => {
    const user = getUsers().find((u) => u.userId === userId);
    if (!user || !user.isLocked || !user.lockedAt) return 0;
    const remaining = LOCK_DURATION_MS - (Date.now() - user.lockedAt);
    return remaining > 0 ? remaining : 0;
  },

  unlockAccount: (userId: string): void => {
    const user = getUsers().find((u) => u.userId === userId);
    if (!user) return;
    user.isLocked = false;
    user.lockedAt = null;
    user.failedLoginAttempts = 0;
    writeUser(user);
  },

  getFailedLoginAttempts: (userId: string): number => {
    const user = getUsers().find((u) => u.userId === userId);
    return user?.failedLoginAttempts ?? 0;
  },

  // Returns the userId of any account currently locked. Used by the login
  // page to re-render the countdown panel after a refresh.
  getPendingLockUserId: (): string | null => {
    const locked = getUsers().find((u) => u.isLocked);
    if (!locked) return null;
    if (lockHasExpired(locked)) {
      authService.unlockAccount(locked.userId);
      return null;
    }
    return locked.userId;
  },
};
