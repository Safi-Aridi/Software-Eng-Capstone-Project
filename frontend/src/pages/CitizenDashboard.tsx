import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  type PassportApplication,
  type ApplicationStatus,
} from "../services/applicationService";
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

  if (!currentUser) return null;

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

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  VERIFIED: "bg-green-100 text-green-800",
  MUKHTAR_SIGNED: "bg-blue-100 text-blue-800",
  PROCESSED: "bg-green-100 text-green-800",
  RESUBMISSION_REQUIRED: "bg-red-100 text-red-800",
  DELIVERED: "bg-green-100 text-green-800",
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING_REVIEW: "Pending Review",
  VERIFIED: "Verified",
  MUKHTAR_SIGNED: "Mukhtar Signed",
  PROCESSED: "Processed",
  RESUBMISSION_REQUIRED: "Resubmission Required",
  DELIVERED: "Delivered",
};

const StatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <span
    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

// ─── Application Card ─────────────────────────────────────────────────────────

const ApplicationCard = ({ app }: { app: PassportApplication }) => {
  const navigate = useNavigate();
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800">
            {app.applicationType === "NEW" ? "New Passport" : "Passport Renewal"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Tracking:{" "}
            <span className="font-mono text-gray-700">{app.trackingNumber}</span>
          </p>
          <p className="text-sm text-gray-500">
            Submitted:{" "}
            {new Date(app.submissionDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={app.currentStatus} />
          <button
            onClick={() => navigate(`/application/status/${app.applicationId}`)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
          >
            Track Application
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Accepted Dashboard ───────────────────────────────────────────────────────

const AcceptedDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const identityData = authService.getSavedIdentityData();
  const displayName =
    (identityData?.fullName as string | undefined) ||
    currentUser?.user?.fullName ||
    "Citizen";

  // TODO: Replace localStorage read with GET /api/applications?role=citizen when backend is ready
  const [applications, setApplications] = useState<PassportApplication[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    (location.state as { successMessage?: string } | null)?.successMessage ?? null,
  );

  useEffect(() => {
    if (currentUser) {
      applicationService
        .getApplications(currentUser.user.id)
        .then(setApplications);
    }
  }, [currentUser]);

  const handleLogout = () => {
    authService.logout();
    window.location.href = "/";
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {successMessage && (
        <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between items-start">
          <div className="flex items-start">
            <span className="text-green-600 mr-2 mt-0.5">✓</span>
            <p className="text-green-800 text-sm">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-500 hover:text-green-700 ml-4 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
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

        {/* Resubmission notification — mimics FR-23 frontend notification */}
        {applications
          .filter((a) => a.currentStatus === "RESUBMISSION_REQUIRED")
          .map((a) => (
            <div
              key={a.applicationId}
              className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <p className="text-yellow-800 text-sm">
                <span className="font-semibold">Action required</span> on
                application{" "}
                <span className="font-mono">{a.trackingNumber}</span>: Documents
                need to be resubmitted.
              </p>
              <button
                onClick={() =>
                  navigate(`/application/status/${a.applicationId}`)
                }
                className="text-xs text-yellow-800 font-semibold underline hover:text-yellow-900 shrink-0"
              >
                View →
              </button>
            </div>
          ))}

        <div className="p-6">
          {/* Section header + apply button */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              My Applications
            </h2>
            <button
              onClick={() => navigate("/application/new")}
              className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Apply for Passport
            </button>
          </div>

          {/* Application list or empty state */}
          {applications.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg">
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
              <p className="text-gray-600 mb-1 font-medium">
                No applications yet.
              </p>
              <p className="text-sm text-gray-500">
                Once you apply for a passport, your applications will appear
                here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <ApplicationCard key={app.applicationId} app={app} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboard;
