import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  type PassportApplication,
  type ApplicationStatus,
} from "../services/applicationService";

// ─── Timeline configuration ───────────────────────────────────────────────────

const TIMELINE_STAGES = [
  {
    key: "SUBMITTED",
    label: "Application Submitted",
    description: "Your application has been received and entered into the system.",
  },
  {
    key: "UNDER_REVIEW",
    label: "Documents Under Review",
    description: "Our team is reviewing your submitted documents.",
  },
  {
    key: "FINGERPRINT_REQUIRED",
    label: "Fingerprint Required",
    description:
      "Please visit your nearest General Security branch for physical fingerprint collection.",
  },
  {
    key: "MUKHTAR_SIGNED",
    label: "Mukhtar Signed",
    description: "Your application has been endorsed by your mukhtar.",
  },
  {
    key: "PROCESSED",
    label: "Approved for Printing",
    description: "Your application has been approved and sent for passport printing.",
  },
  {
    key: "ISSUED",
    label: "Passport Issued",
    description: "Your new passport has been issued and handed to LibanPost for delivery.",
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    description: "Your passport has been delivered.",
  },
];

// Number of completed stages (stages before the current active one).
// DELIVERED = 7 so all 7 stages are covered by i < 7.
const COMPLETED_BEFORE: Record<ApplicationStatus, number> = {
  PENDING_REVIEW: 1,
  RESUBMISSION_REQUIRED: 1,
  FINGERPRINT_REQUIRED: 2,
  VERIFIED: 2, // legacy alias
  MUKHTAR_SIGNED: 3,
  PROCESSED: 4,
  ISSUED: 5,
  DELIVERED: 7,
};

// Stage index whose statusHistory entry provides its timestamp (0 = submissionDate)
const STAGE_HISTORY_STATUS: Record<number, ApplicationStatus | null> = {
  0: null, // always submissionDate
  1: "PENDING_REVIEW",
  2: "FINGERPRINT_REQUIRED",
  3: "MUKHTAR_SIGNED",
  4: "PROCESSED",
  5: "ISSUED",
  6: "DELIVERED",
};

// TODO: Replace with real branch processing speed calculation (FR-11, FR-27)
const getEstimate = (status: ApplicationStatus): string => {
  switch (status) {
    case "PENDING_REVIEW":
      return "Estimated: 5–7 business days";
    case "FINGERPRINT_REQUIRED":
      return "Visit your nearest branch for fingerprint collection to proceed";
    case "VERIFIED":
      return "Estimated: 3–5 business days";
    case "MUKHTAR_SIGNED":
      return "Estimated: 2–3 business days";
    case "PROCESSED":
      return "Estimated: 1–2 business days";
    case "ISSUED":
      return "Passport issued — awaiting delivery";
    case "DELIVERED":
      return "Completed";
    case "RESUBMISSION_REQUIRED":
      return "On hold — awaiting document resubmission";
  }
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING_REVIEW: "Pending Review",
  FINGERPRINT_REQUIRED: "Fingerprint Required",
  VERIFIED: "Verified",
  MUKHTAR_SIGNED: "Mukhtar Signed",
  PROCESSED: "Approved for Printing",
  ISSUED: "Passport Issued",
  RESUBMISSION_REQUIRED: "Resubmission Required",
  DELIVERED: "Delivered",
};

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  FINGERPRINT_REQUIRED: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-green-100 text-green-800",
  MUKHTAR_SIGNED: "bg-blue-100 text-blue-800",
  PROCESSED: "bg-green-100 text-green-800",
  ISSUED: "bg-emerald-100 text-emerald-800",
  RESUBMISSION_REQUIRED: "bg-red-100 text-red-800",
  DELIVERED: "bg-green-100 text-green-800",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Main Page ────────────────────────────────────────────────────────────────

const ApplicationStatusPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { applicationId } = useParams<{ applicationId: string }>();
  const currentUser = authService.getCurrentUser();

  const [app, setApp] = useState<PassportApplication | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [successMessage] = useState<string | null>(
    (location.state as { successMessage?: string } | null)?.successMessage ??
      null,
  );

  useEffect(() => {
    if (!currentUser || !applicationId) {
      navigate("/");
      return;
    }
    applicationService
      .getApplicationById(currentUser.user.id, applicationId)
      .then((found) => {
        if (!found) {
          setNotFound(true);
        } else {
          setApp(found);
        }
      });
  }, [currentUser, applicationId, navigate]);

  if (!currentUser || currentUser.role !== "citizen") {
    navigate("/");
    return null;
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto text-center py-16">
          <p className="text-gray-500 text-lg mb-4">Application not found.</p>
          <button
            onClick={() => navigate("/citizen/dashboard")}
            className="text-blue-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!app) return null;

  const completedBefore = COMPLETED_BEFORE[app.currentStatus];
  const isResubmissionRequired = app.currentStatus === "RESUBMISSION_REQUIRED";

  const getStageTimestamp = (stageIdx: number): string | null => {
    if (stageIdx === 0) return app.submissionDate;
    const targetStatus = STAGE_HISTORY_STATUS[stageIdx];
    if (!targetStatus || !app.statusHistory) return null;
    const entry = app.statusHistory.find((e) => e.status === targetStatus);
    return entry?.timestamp ?? null;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate("/citizen/dashboard")}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-6 text-sm font-medium"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </button>

        {/* Success banner (from resubmission redirect) */}
        {successMessage && (
          <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start">
              <span className="text-green-600 mr-2 mt-0.5">✓</span>
              <p className="text-green-800 text-sm">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Resubmission CTA banner */}
        {/* TODO: FR-23 — trigger resubmission notification from backend when status is set to RESUBMISSION_REQUIRED */}
        {isResubmissionRequired && (
          <div className="mb-5 p-4 bg-red-50 border border-red-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-semibold text-red-800 text-sm">
                Action Required: Documents could not be verified
              </p>
              <p className="text-red-700 text-sm mt-0.5">
                Please resubmit your documents to continue your application.
              </p>
            </div>
            <button
              onClick={() =>
                navigate(`/application/resubmit/${app.applicationId}`)
              }
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium shrink-0"
            >
              Resubmit Documents
            </button>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-800 mb-5">
          Application Status
        </h1>

        {/* Summary card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-5">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {app.applicationType === "NEW"
                ? "New Passport Application"
                : "Passport Renewal Application"}
            </h2>
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[app.currentStatus]}`}
            >
              {STATUS_LABELS[app.currentStatus]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-gray-500">Tracking Number</p>
              <p className="font-mono font-medium text-gray-800">
                {app.trackingNumber}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Submission Date</p>
              <p className="font-medium text-gray-800">
                {new Date(app.submissionDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Passport Validity</p>
              <p className="font-medium text-gray-800">
                {app.passportValidity} Years
              </p>
            </div>
            <div>
              <p className="text-gray-500">Fee</p>
              <p className="font-medium text-gray-800">
                {app.feeAmount.toLocaleString()} LBP
              </p>
            </div>
          </div>

          {/* Estimated completion */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
              Estimated Completion
            </p>
            <p
              className={`text-sm font-medium ${
                app.currentStatus === "DELIVERED"
                  ? "text-green-700"
                  : app.currentStatus === "RESUBMISSION_REQUIRED"
                    ? "text-red-600"
                    : "text-blue-700"
              }`}
            >
              {getEstimate(app.currentStatus)}
            </p>
          </div>
        </div>

        {/* Status timeline */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            Status Timeline
          </h2>

          <div className="relative">
            {TIMELINE_STAGES.map((stage, idx) => {
              const isCompleted = idx < completedBefore;
              const isActive =
                idx === completedBefore && app.currentStatus !== "DELIVERED";
              const isError = isActive && isResubmissionRequired;
              const isPending = !isCompleted && !isActive;
              const timestamp = isCompleted || isActive
                ? getStageTimestamp(idx)
                : null;

              return (
                <div key={stage.key} className="flex gap-4">
                  {/* Circle + connector */}
                  <div className="flex flex-col items-center">
                    {/* Circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all
                        ${isCompleted
                          ? "bg-green-600 text-white"
                          : isError
                            ? "bg-red-500 text-white ring-4 ring-red-200"
                            : isActive
                              ? "bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse"
                              : "bg-white border-2 border-gray-300 text-gray-400"
                        }`}
                    >
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : isError ? (
                        <span className="text-xs font-bold">!</span>
                      ) : (
                        <span className="text-xs font-medium">{idx + 1}</span>
                      )}
                    </div>

                    {/* Connector line */}
                    {idx < TIMELINE_STAGES.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 my-1 ${
                          isCompleted
                            ? "bg-green-400"
                            : "border-l-2 border-dashed border-gray-300"
                        }`}
                        style={{ minHeight: "2.5rem" }}
                      />
                    )}
                  </div>

                  {/* Stage content */}
                  <div className={`pb-6 ${idx === TIMELINE_STAGES.length - 1 ? "pb-0" : ""}`}>
                    <p
                      className={`font-medium text-sm ${
                        isCompleted
                          ? "text-green-700"
                          : isError
                            ? "text-red-700"
                            : isActive
                              ? "text-blue-700"
                              : "text-gray-400"
                      }`}
                    >
                      {stage.label}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        isPending ? "text-gray-300" : "text-gray-500"
                      }`}
                    >
                      {isError
                        ? "Action Required: Please resubmit your documents."
                        : stage.description}
                    </p>
                    {timestamp && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(timestamp)}
                      </p>
                    )}
                    {isActive && !isError && (
                      <span className="inline-flex mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                        In Progress
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationStatusPage;
