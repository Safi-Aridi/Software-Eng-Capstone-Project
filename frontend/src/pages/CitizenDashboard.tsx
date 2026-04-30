import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import AccountLockedPanel from "../components/kyc/AccountLockedPanel";
import IdentityVerificationPendingPanel from "../components/kyc/IdentityVerificationPendingPanel";
import IdentityVerificationRejectedPanel from "../components/kyc/IdentityVerificationRejectedPanel";

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }

    if (currentUser.role !== "citizen") {
      authService.logout();
      navigate("/");
      return;
    }
  }, [currentUser, navigate]);

  if (!currentUser) {
    return null;
  }

  const renderDashboard = () => {
    switch (currentUser.accountStatus) {
      case "NO_IDENTITY_VERIFICATION":
        return (
          <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Identity Verification Not Submitted
              </h2>
              <p className="text-gray-600 mb-4">
                You have not submitted identity verification yet.
              </p>
              <button
                onClick={() => navigate("/identity-verification")}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Complete Identity Verification
              </button>
            </div>
          </div>
        );

      case "PENDING_IDENTITY_VERIFICATION":
        return <IdentityVerificationPendingPanel />;

      case "IDENTITY_VERIFICATION_REJECTED":
        return <IdentityVerificationRejectedPanel />;

      case "ACTIVE":
        return <AcceptedDashboard />;

      case "LOCKED":
        return <AccountLockedPanel />;

      default:
        return (
          <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Identity Verification Not Submitted
              </h2>
              <p className="text-gray-600 mb-4">
                You have not submitted identity verification yet.
              </p>
              <button
                onClick={() => navigate("/identity-verification")}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Complete Identity Verification
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {renderDashboard()}
    </div>
  );
};

// Shown when accountStatus === "ACTIVE" (identity verified).
// TODO: fetch /api/applications?role=citizen to populate real application data.
const AcceptedDashboard = () => {
  const currentUser = authService.getCurrentUser();
  const identityData = authService.getSavedIdentityData();
  const displayName =
    identityData?.fullName || currentUser?.user?.fullName || "Citizen";

  const handleLogout = () => {
    authService.logout();
    window.location.href = "/";
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Welcome, {displayName}
              </h1>
              <p className="text-gray-600 mt-1">
                Your identity has been verified. You can now apply for a
                passport.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            My Applications
          </h2>

          <div className="text-center py-10 bg-gray-50 rounded-lg mb-6">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-600 mb-1 font-medium">No applications yet.</p>
            <p className="text-sm text-gray-500">
              Once you apply for a passport, your applications will appear here.
            </p>
          </div>

          <div className="text-center">
            <button
              disabled
              className="bg-blue-600 text-white px-6 py-3 rounded-md text-base font-medium opacity-75 cursor-not-allowed"
              title="Coming soon"
            >
              Apply for Passport
            </button>
            <p className="text-xs text-gray-400 mt-2">Passport application coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboard;
