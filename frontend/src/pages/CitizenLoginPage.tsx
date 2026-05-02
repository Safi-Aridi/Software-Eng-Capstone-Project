import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const LockedPanel = ({
  userId,
  onUnlock,
}: {
  userId: string;
  onUnlock: () => void;
}) => {
  const [remaining, setRemaining] = useState(() =>
    authService.getRemainingLockTime(userId),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = authService.getRemainingLockTime(userId);
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(interval);
        authService.unlockAccount(userId);
        onUnlock();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [userId, onUnlock]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Your account is locked
        </h1>
        <p className="text-gray-600 mb-6">
          Too many failed attempts. Your account has been locked.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700 mb-1">Try again in</p>
          <p
            className="text-3xl font-mono font-bold text-red-700 tabular-nums"
            aria-live="polite"
          >
            {formatCountdown(remaining)}
          </p>
        </div>
        <p className="text-xs text-gray-500">
          The login form will reappear automatically when the timer reaches
          0:00.
        </p>
      </div>
    </div>
  );
};

const CitizenLoginPage = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lockedUserId, setLockedUserId] = useState<string | null>(() =>
    authService.getPendingLockUserId(),
  );
  const navigate = useNavigate();

  useEffect(() => {
    setLockedUserId(authService.getPendingLockUserId());
  }, []);

  const handleUnlock = () => {
    setLockedUserId(null);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Brief delay so the loading state is visible — login is otherwise synchronous
    await new Promise((r) => setTimeout(r, 250));

    const result = await authService.login(identifier, password);

    if (result.isLocked && result.lockedUserId) {
      setLockedUserId(result.lockedUserId);
    } else if (!result.success) {
      setError(result.message);
    } else {
      navigate("/citizen/dashboard");
    }

    setIsLoading(false);
  };

  if (lockedUserId) {
    return <LockedPanel userId={lockedUserId} onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Lebanese Passport Issuance Platform
          </h1>
          <p className="text-gray-600">Secure citizen access portal</p>
        </div>

        {/* TODO FR-05: Add OTP login option as alternative to password */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter mobile number or email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <div>
            <span className="text-gray-600">Don't have an account? </span>
            <a
              href="/signup"
              className="text-blue-600 hover:underline font-medium"
            >
              Create citizen account
            </a>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <a
              href="/authorized-login"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Authorized personnel access
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenLoginPage;
