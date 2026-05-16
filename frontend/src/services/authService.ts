export type UserRole = "citizen" | "mukhtar" | "officer";

export type AccountStatus =
  | "NO_IDENTITY_VERIFICATION"
  | "PENDING_IDENTITY_VERIFICATION"
  | "IDENTITY_VERIFICATION_REJECTED"
  | "ACTIVE"
  | "LOCKED";

export interface StoredUser {
  userId: string;
  email: string;
  password: string;
  fullName: string;
  mobileNumber: string;
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

export interface RegisterData {
  email: string;
  password: string;

  first_name?: string;
  last_name?: string;
  phone?: string;

  // Kept for compatibility with older frontend code
  firstName?: string;
  lastName?: string;
  Sphone?: string;
  mobileNumber?: string;
  fullName?: string;

  role?: UserRole;
}

const SESSION_KEY = "npis_user";
const USERS_KEY = "npis_users";
const AUTHORIZED_USERS_KEY = "npis_authorized_users";

const API_TOKEN_KEY = "npis_token";
const API_SESSION_KEY = "npis_session";

const USE_MOCK_AUTH =
  (import.meta.env.VITE_USE_MOCK_AUTH ?? "true") !== "false";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

interface ApiUser {
  id?: string;
  user_id?: string;
  email: string;
  role: UserRole;
  fullName?: string | null;
  full_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface ApiLoginSuccess {
  success: true;
  token: string;
  user: ApiUser;
}

interface ApiLoginError {
  message?: string;
  isLocked?: boolean;
  failedAttempts?: number;
  remainingAttempts?: number;
  lockedUntil?: string;
}

const normalizeRegisterData = (data: RegisterData) => {
  const firstName = (data.first_name ?? data.firstName ?? "").trim();
  const lastName = (data.last_name ?? data.lastName ?? "").trim();

  const phone = (
    data.phone ??
    data.Sphone ??
    data.mobileNumber ??
    ""
  ).trim();

  const fullName =
    data.fullName?.trim() || `${firstName} ${lastName}`.trim();

  return {
    firstName,
    lastName,
    phone,
    fullName,
  };
};

const getApiUserId = (user: ApiUser): string => {
  return user.id || user.user_id || "";
};

const getApiFullName = (user: ApiUser): string => {
  if (user.fullName) return user.fullName;
  if (user.full_name) return user.full_name;

  const firstName = user.first_name || user.firstName || "";
  const lastName = user.last_name || user.lastName || "";

  return `${firstName} ${lastName}`.trim();
};

const sessionRecordFromApi = (token: string, user: ApiUser): MockUser => ({
  token,
  role: user.role,
  accountStatus: "ACTIVE",
  user: {
    id: getApiUserId(user),
    fullName: getApiFullName(user),
    email: user.email,
  },
});

const persistApiSession = (token: string, user: ApiUser): MockUser => {
  const fullName = getApiFullName(user);
  const userId = getApiUserId(user);

  localStorage.setItem(API_TOKEN_KEY, token);
  localStorage.setItem(
    API_SESSION_KEY,
    JSON.stringify({
      userId,
      email: user.email,
      role: user.role,
      fullName,
      isAuthenticated: true,
    }),
  );

  return sessionRecordFromApi(token, user);
};

const apiLogin = async (
  email: string,
  password: string,
): Promise<LoginResult> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = (await res.json().catch(() => ({}))) as
      | ApiLoginSuccess
      | ApiLoginError;

    if (!res.ok) {
      const err = body as ApiLoginError;

      return {
        success: false,
        message: err.message || "Invalid credentials",
        failedAttempts: err.failedAttempts ?? 0,
        remainingAttempts: err.remainingAttempts ?? MAX_LOGIN_ATTEMPTS,
        isLocked: !!err.isLocked,
        ...(err.isLocked && { lockedUserId: email }),
      };
    }

    const ok = body as ApiLoginSuccess;
    const mockUser = persistApiSession(ok.token, ok.user);

    return {
      success: true,
      message: "Login successful",
      failedAttempts: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      isLocked: false,
      user: mockUser,
    };
  } catch {
    return {
      success: false,
      message: "Unable to reach authentication server",
      failedAttempts: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      isLocked: false,
    };
  }
};

const apiRegister = async (data: RegisterData): Promise<MockUser> => {
  const { firstName, lastName, phone } = normalizeRegisterData(data);

  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName,
      lastName,
      phone,
      email: data.email,
      password: data.password,
      role: data.role ?? "citizen",
    }),
  });

  const body = (await res.json().catch(() => ({}))) as
    | ApiLoginSuccess
    | ApiLoginError;

  if (!res.ok) {
    throw new Error((body as ApiLoginError).message || "Registration failed");
  }

  const ok = body as ApiLoginSuccess;
  return persistApiSession(ok.token, ok.user);
};

const apiLogout = async (): Promise<void> => {
  try {
    const token = localStorage.getItem(API_TOKEN_KEY);

    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // ignore stateless logout errors
  }

  localStorage.removeItem(API_TOKEN_KEY);
  localStorage.removeItem(API_SESSION_KEY);
};

const readApiSession = (): MockUser | null => {
  const stored = localStorage.getItem(API_SESSION_KEY);
  if (!stored) return null;

  try {
    const s = JSON.parse(stored) as {
      userId: string;
      email: string;
      role: UserRole;
      fullName: string;
    };

    const token = localStorage.getItem(API_TOKEN_KEY) || "";

    return {
      token,
      role: s.role,
      accountStatus: "ACTIVE",
      user: {
        id: s.userId,
        email: s.email,
        fullName: s.fullName,
      },
    };
  } catch {
    return null;
  }
};

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

const writeUser = (updated: StoredUser): void => {
  const users = getUsers();
  const idx = users.findIndex((u) => u.userId === updated.userId);

  if (idx < 0) return;

  users[idx] = updated;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const lockHasExpired = (user: StoredUser): boolean => {
  if (!user.isLocked || !user.lockedAt) return false;
  return Date.now() - user.lockedAt >= LOCK_DURATION_MS;
};

export const authService = {
  login: async (
    identifier: string,
    password: string,
  ): Promise<LoginResult> => {
    if (!USE_MOCK_AUTH) return apiLogin(identifier, password);
    return authService.loginCitizen(identifier, password);
  },

  register: async (data: RegisterData): Promise<MockUser> => {
    if (!USE_MOCK_AUTH) {
      return apiRegister({ ...data, role: "citizen" });
    }

    return authService.registerCitizen(data);
  },

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

    if (matched.isLocked && lockHasExpired(matched)) {
      matched.isLocked = false;
      matched.lockedAt = null;
      matched.failedLoginAttempts = 0;
      writeUser(matched);
    }

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
        message: `Invalid credentials. ${remaining} attempt${
          remaining === 1 ? "" : "s"
        } remaining before your account is locked.`,
        failedAttempts: next,
        remainingAttempts: remaining,
        isLocked: false,
      };
    }

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

  registerCitizen: (data: RegisterData): MockUser => {
    const users = getUsers();

    const { fullName, phone } = normalizeRegisterData(data);

    const existing = users.find(
      (u) => u.email === data.email || u.mobileNumber === phone,
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
      fullName,
      mobileNumber: phone,
      failedLoginAttempts: 0,
      isLocked: false,
      lockedAt: null,
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

  loginAuthorized: async (
    identifier: string,
    password: string,
  ): Promise<MockUser> => {
    if (!identifier || !password) {
      throw new Error("Authorized ID/email and password are required");
    }

    if (!USE_MOCK_AUTH) {
      let res: Response;

      try {
        res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: identifier, password }),
        });
      } catch {
        throw new Error("Unable to reach authentication server");
      }

      const body = (await res.json().catch(() => ({}))) as
        | ApiLoginSuccess
        | ApiLoginError;

      if (!res.ok) {
        throw new Error(
          (body as ApiLoginError).message || "Invalid credentials",
        );
      }

      const ok = body as ApiLoginSuccess;
      return persistApiSession(ok.token, ok.user);
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
    if (!USE_MOCK_AUTH) {
      const api = readApiSession();
      if (api) return api;
    }

    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  logout: (): void => {
    if (!USE_MOCK_AUTH) {
      void apiLogout();
    }

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

  updateContactInfo: (
    update: { email?: string; mobileNumber?: string },
  ): { success: boolean; message?: string } => {
    const currentUser = authService.getCurrentUser();

    if (!currentUser) {
      return { success: false, message: "Not authenticated" };
    }

    const userId = currentUser.user.id;
    const users = getUsers();
    const idx = users.findIndex((u) => u.userId === userId);

    if (idx < 0) {
      return { success: false, message: "Account not found" };
    }

    if (update.email !== undefined) {
      const collision = users.find(
        (u) => u.userId !== userId && u.email === update.email,
      );

      if (collision) {
        return {
          success: false,
          message: "That email is already used by another account.",
        };
      }

      users[idx].email = update.email;
    }

    if (update.mobileNumber !== undefined) {
      const collision = users.find(
        (u) => u.userId !== userId && u.mobileNumber === update.mobileNumber,
      );

      if (collision) {
        return {
          success: false,
          message: "That mobile number is already used by another account.",
        };
      }

      users[idx].mobileNumber = update.mobileNumber;
    }

    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    const updatedSession: MockUser = {
      ...currentUser,
      user: {
        ...currentUser.user,
        ...(update.email !== undefined && { email: update.email }),
        ...(update.mobileNumber !== undefined && {
          mobileNumber: update.mobileNumber,
        }),
      },
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));

    return { success: true };
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
      user: {
        ...currentUser.user,
        fullName: identityData.fullName,
      },
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

  validateOtp: (mobile: string, entered: string): OtpResult => {
    const record = readOtp(mobile);

    if (!record) return "EXPIRED";
    if (record.attempts >= OTP_MAX_ATTEMPTS) return "LOCKED";
    if (Date.now() > record.expiresAt) return "EXPIRED";

    if (record.code !== entered) {
      const updated: OtpRecord = {
        ...record,
        attempts: record.attempts + 1,
      };

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

  lockAccount: (userId: string): void => {
    const user = getUsers().find((u) => u.userId === userId);

    if (!user) return;

    user.isLocked = true;
    user.lockedAt = Date.now();
    user.failedLoginAttempts = MAX_LOGIN_ATTEMPTS;

    writeUser(user);
  },

  isAccountLocked: (userId: string): boolean => {
    const user = getUsers().find((u) => u.userId === userId);

    if (!user || !user.isLocked) return false;

    if (lockHasExpired(user)) {
      authService.unlockAccount(userId);
      return false;
    }

    return true;
  },

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