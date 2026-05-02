import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  type PassportApplication,
  type ApplicationStatus,
} from "../services/applicationService";
import { paymentService } from "../services/paymentService";
import AccountLockedPanel from "../components/kyc/AccountLockedPanel";
import IdentityVerificationPendingPanel from "../components/kyc/IdentityVerificationPendingPanel";
import IdentityVerificationRejectedPanel from "../components/kyc/IdentityVerificationRejectedPanel";
import NotificationCenter from "../components/NotificationCenter";

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  // getCurrentUser() returns a fresh object each call, so depend on stable primitives
  // (id + role) to prevent the effect from re-firing on every render.
  const userId = currentUser?.user.id;
  const userRole = currentUser?.role;

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }
    if (userRole !== "citizen") {
      authService.logout();
      navigate("/");
      return;
    }
  }, [userId, userRole, navigate]);

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
  const isUnpaid = app.paymentStatus === "UNPAID";
  const isPaymentFailed = app.paymentStatus === "Failed";

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        isUnpaid
          ? "border-yellow-300"
          : isPaymentFailed
            ? "border-red-300"
            : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      {isUnpaid && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-yellow-800 text-xs font-medium">Payment Pending</span>
          </div>
          <button
            onClick={() => navigate(`/application/pay/${app.applicationId}`)}
            className="text-xs bg-yellow-600 text-white px-3 py-1 rounded-full hover:bg-yellow-700 transition-colors font-medium"
          >
            Complete Payment
          </button>
        </div>
      )}
      {isPaymentFailed && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-red-800 text-xs font-medium">Payment Failed</span>
          </div>
          <button
            onClick={() => navigate(`/application/pay/${app.applicationId}`)}
            className="text-xs bg-red-600 text-white px-3 py-1 rounded-full hover:bg-red-700 transition-colors font-medium"
          >
            Retry Payment
          </button>
        </div>
      )}
      <div className="p-4">
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
  // Stable primitive — getCurrentUser() returns a fresh object reference each call,
  // so depending on it directly causes an infinite re-render loop.
  const userId = currentUser?.user.id;

  // TODO: Replace localStorage read with GET /api/applications?role=citizen when backend is ready
  const [applications, setApplications] = useState<PassportApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApplicationStatus>(
    "ALL",
  );
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [successMessage, setSuccessMessage] = useState<string | null>(
    (location.state as { successMessage?: string } | null)?.successMessage ?? null,
  );

  const visibleApplications = useMemo(() => {
    const filtered =
      statusFilter === "ALL"
        ? applications
        : applications.filter((a) => a.currentStatus === statusFilter);
    return [...filtered].sort((a, b) => {
      const da = new Date(a.submissionDate).getTime();
      const db = new Date(b.submissionDate).getTime();
      return sortOrder === "NEWEST" ? db - da : da - db;
    });
  }, [applications, statusFilter, sortOrder]);

  useEffect(() => {
    if (!userId) return;
    // FR-30: auto-fail UNPAID applications older than 15 minutes
    paymentService
      .checkExpiredPayments(userId)
      .then(() =>
        applicationService.getApplications(userId).then(setApplications),
      );
  }, [userId]);

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
            <div className="flex items-center gap-2">
              {userId && <NotificationCenter userId={userId} />}
              <button
                onClick={() => navigate("/citizen/profile")}
                aria-label="Profile"
                className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-md transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
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
              onClick={() => navigate("/application/checklist")}
              className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Apply for Passport
            </button>
          </div>

          {/* Application list, toolbar, or empty state */}
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
            <>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">
                    Status
                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as "ALL" | ApplicationStatus,
                        )
                      }
                      className="ml-2 text-xs bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Statuses</option>
                      {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    Sort
                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "NEWEST" | "OLDEST")
                      }
                      className="ml-2 text-xs bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="NEWEST">Newest First</option>
                      <option value="OLDEST">Oldest First</option>
                    </select>
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Showing {visibleApplications.length} of {applications.length}{" "}
                  application{applications.length === 1 ? "" : "s"}
                </p>
              </div>

              {visibleApplications.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 font-medium">
                    No applications match this filter.
                  </p>
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium mt-2"
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleApplications.map((app) => (
                    <ApplicationCard key={app.applicationId} app={app} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboard;
