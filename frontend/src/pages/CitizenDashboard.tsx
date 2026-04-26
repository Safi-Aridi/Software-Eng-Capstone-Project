import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService, type AccountStatus } from "../services/authService";
import KycSubmissionPanel from "../components/kyc/KycSubmissionPanel";
import KycPendingPanel from "../components/kyc/KycPendingPanel";
import KycRejectedPanel from "../components/kyc/KycRejectedPanel";
import CitizenDashboardContent from "../components/kyc/CitizenDashboardContent";
import AccountLockedPanel from "../components/kyc/AccountLockedPanel";

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    // Redirect if no user or wrong role
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
    return null; // Will redirect
  }

  const renderKycComponent = () => {
    switch (currentUser.accountStatus) {
      case "NO_KYC_SUBMITTED":
        return <KycSubmissionPanel />;
      case "PENDING_KYC":
        return <KycPendingPanel />;
      case "KYC_REJECTED":
        return <KycRejectedPanel />;
      case "ACTIVE":
        return <CitizenDashboardContent />;
      case "LOCKED":
        return <AccountLockedPanel />;
      default:
        return <KycSubmissionPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">{renderKycComponent()}</div>
  );
};

export default CitizenDashboard;
