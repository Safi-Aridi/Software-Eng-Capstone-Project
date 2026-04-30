export type UserRole = "citizen" | "mukhtar";

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

const SESSION_KEY = "npis_user";
const USERS_KEY = "npis_users";

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

export const authService = {
  loginCitizen: (identifier: string, password: string): MockUser => {
    if (!identifier || !password) {
      throw new Error("Mobile number/email and password are required");
    }

    const users = getUsers();
    const found = users.find(
      (u) =>
        (u.email === identifier || u.mobileNumber === identifier) &&
        u.password === password,
    );

    if (!found) {
      throw new Error(
        "Invalid credentials. Please check your mobile number/email and password.",
      );
    }

    const rawStatus =
      localStorage.getItem(kycStatusKey(found.userId)) ||
      "NO_IDENTITY_VERIFICATION";
    const accountStatus = resolveAccountStatus(rawStatus);

    const mockUser: MockUser = {
      token: "mock-citizen-token-" + Date.now(),
      role: "citizen",
      accountStatus,
      user: {
        id: found.userId,
        fullName: found.fullName,
        mobileNumber: found.mobileNumber,
        email: found.email,
      },
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
    return mockUser;
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

    const mockUser: MockUser = {
      token: "mock-mukhtar-token-" + Date.now(),
      role: "mukhtar",
      accountStatus: "ACTIVE",
      user: {
        id: "mukhtar-" + Date.now(),
        fullName: "Mukhtar User",
        mobileNumber: identifier.includes("@") ? undefined : identifier,
        email: identifier.includes("@") ? identifier : undefined,
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

  saveIdentityData: (identityData: any): void => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;
    localStorage.setItem(
      identityDataKey(currentUser.user.id),
      JSON.stringify(identityData),
    );
  },

  getSavedIdentityData: (): any => {
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

  getIdentityData: (): any => {
    return authService.getSavedIdentityData();
  },
};

