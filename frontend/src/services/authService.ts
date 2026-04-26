export type UserRole = "citizen" | "mukhtar";

export type AccountStatus =
  | "NO_KYC_SUBMITTED"
  | "PENDING_KYC"
  | "KYC_REJECTED"
  | "ACTIVE"
  | "LOCKED";

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

const STORAGE_KEY = 'npis_user';

export const authService = {
  loginCitizen: (identifier: string, password: string): MockUser => {
    if (!identifier || !password) {
      throw new Error('Mobile number/email and password are required');
    }

    const mockUser: MockUser = {
      token: 'mock-citizen-token-' + Date.now(),
      role: 'citizen',
      accountStatus: 'NO_KYC_SUBMITTED',
      user: {
        id: 'citizen-' + Date.now(),
        fullName: 'Citizen User',
        mobileNumber: identifier.includes('@') ? undefined : identifier,
        email: identifier.includes('@') ? identifier : undefined,
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    return mockUser;
  },

  loginAuthorized: (identifier: string, password: string): MockUser => {
    if (!identifier || !password) {
      throw new Error('Authorized ID/email and password are required');
    }

    const mockUser: MockUser = {
      token: 'mock-mukhtar-token-' + Date.now(),
      role: 'mukhtar',
      accountStatus: 'ACTIVE',
      user: {
        id: 'mukhtar-' + Date.now(),
        fullName: 'Mukhtar User',
        mobileNumber: identifier.includes('@') ? undefined : identifier,
        email: identifier.includes('@') ? identifier : undefined,
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    return mockUser;
  },

  getCurrentUser: (): MockUser | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  logout: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!authService.getCurrentUser();
  },

  updateAccountStatus: (status: AccountStatus, kycIssueDescription?: string): void => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const updatedUser: MockUser = {
      ...currentUser,
      accountStatus: status,
      ...(kycIssueDescription && { kycIssueDescription })
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
  },

  updateKycData: (kycData: { fullName: string; registryNumber: string; dob: string }): void => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const updatedUser: MockUser = {
      ...currentUser,
      user: {
        ...currentUser.user,
        fullName: kycData.fullName
      },
      // Store KYC data separately for now
      kycData
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
  }
};

export type { MockUser };
