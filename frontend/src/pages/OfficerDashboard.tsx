import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { officerService } from "../services/officerService";
import type { EnrichedApplication } from "../services/applicationService";
import type { MukhtarSignature } from "../services/mukhtarService";

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: "success" | "error";
}

const Toast = ({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
        toast.type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {toast.message}
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    VERIFIED: "bg-blue-100 text-blue-800",
    MUKHTAR_SIGNED: "bg-purple-100 text-purple-800",
    PROCESSED: "bg-green-100 text-green-800",
    RESUBMISSION_REQUIRED: "bg-yellow-100 text-yellow-800",
    PENDING_REVIEW: "bg-gray-100 text-gray-700",
  };
  const labels: Record<string, string> = {
    VERIFIED: "Verified",
    MUKHTAR_SIGNED: "Mukhtar Signed",
    PROCESSED: "Processed",
    RESUBMISSION_REQUIRED: "Resubmission Required",
    PENDING_REVIEW: "Pending Review",
  };
  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {labels[status] ?? status}
    </span>
  );
};

// ─── Queue Card ───────────────────────────────────────────────────────────────

const QueueCard = ({
  item,
  signedAt,
  onClick,
}: {
  item: EnrichedApplication;
  signedAt: string | null;
  onClick: () => void;
}) => {
  const { app, citizenIdentity } = item;
  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg p-4 hover:bg-purple-50 hover:border-purple-300 cursor-pointer transition-colors"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">
            {citizenIdentity?.fullName ?? "Unknown Citizen"}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {app.applicationType === "NEW" ? "New Passport" : "Passport Renewal"}{" "}
            &mdash; {app.mukhtarFormData.district}
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            {app.trackingNumber}
          </p>
          {signedAt && (
            <p className="text-xs text-purple-600 mt-0.5">
              Signed:{" "}
              {new Date(signedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={app.currentStatus} />
          <span className="text-xs text-purple-600 font-medium">Process →</span>
        </div>
      </div>
    </div>
  );
};

// ─── Cancel Old Passport Modal (FR-19) ───────────────────────────────────────

const CancelOldPassportModal = ({
  trackingNumber,
  onConfirm,
  onSkip,
  isProcessing,
  cancelled,
}: {
  trackingNumber: string;
  onConfirm: () => void;
  onSkip: () => void;
  isProcessing: boolean;
  cancelled: boolean;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
      {cancelled ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Old Passport Record Cancelled
            </span>
          </div>
          <p className="text-gray-700 text-sm mb-6">
            The old passport record for{" "}
            <span className="font-mono font-semibold">{trackingNumber}</span> has
            been marked as cancelled in the system.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onSkip}
              className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            Confirm Old Passport Cancellation
          </h3>
          <p className="text-gray-600 text-sm mb-6">
            Confirm physical booklet destruction for{" "}
            <span className="font-mono font-semibold">{trackingNumber}</span>.
            This will cancel the old passport record in the system.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onSkip}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              Skip
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Cancelling…" : "Confirm Cancellation"}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
);

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal = ({
  item,
  signature,
  onClose,
  onApprove,
}: {
  item: EnrichedApplication;
  signature: MukhtarSignature | null;
  onClose: () => void;
  onApprove: () => void;
}) => {
  const { app, citizenIdentity } = item;
  const dob = citizenIdentity?.dateOfBirth ?? citizenIdentity?.dob ?? "—";

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 mb-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Final Processing Review
            </h2>
            <p className="text-sm font-mono text-gray-500">
              {app.trackingNumber}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={app.currentStatus} />
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Citizen Identity */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Citizen Identity
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-gray-500">Full Name</p>
                <p className="font-medium text-gray-800">
                  {citizenIdentity?.fullName ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Registry Number</p>
                <p className="font-medium text-gray-800 font-mono">
                  {citizenIdentity?.registryNumber ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Date of Birth</p>
                <p className="font-medium text-gray-800">{dob}</p>
              </div>
              <div>
                <p className="text-gray-500">District</p>
                <p className="font-medium text-gray-800">
                  {app.mukhtarFormData.district}
                </p>
              </div>
            </div>
          </section>

          {/* Application Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Application Details
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-medium text-gray-800">
                  {app.applicationType === "NEW"
                    ? "New Passport"
                    : "Passport Renewal"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Validity</p>
                <p className="font-medium text-gray-800">
                  {app.passportValidity} Years
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
                <p className="text-gray-500">Fee</p>
                <p className="font-medium text-gray-800">
                  {app.feeAmount.toLocaleString()} LBP
                </p>
              </div>
            </div>
          </section>

          {/* Mukhtar Signature Info */}
          {signature && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Mukhtar Signature
              </h3>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm space-y-1">
                <p>
                  <span className="text-gray-500">Signature ID: </span>
                  <span className="font-mono text-gray-800 text-xs">
                    {signature.signatureId}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Algorithm: </span>
                  <span className="font-mono text-gray-800 text-xs">
                    {signature.algorithm}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Signed: </span>
                  <span className="text-gray-800">
                    {new Date(signature.timestamp).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Digest: </span>
                  <span className="font-mono text-gray-600 text-xs">
                    {signature.digest}
                  </span>
                </p>
              </div>
            </section>
          )}

          {/* Documents */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Submitted Documents
            </h3>
            <div className="space-y-2">
              {app.documents.identityDocument && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-xs font-bold">
                    {/\.(jpg|jpeg|png)$/i.test(app.documents.identityDocument)
                      ? "IMG"
                      : "PDF"}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      Identity Document
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {app.documents.identityDocument}
                    </p>
                  </div>
                </div>
              )}
              {app.documents.passportPhoto && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-xs font-bold">
                    IMG
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      Passport Photo
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {app.documents.passportPhoto}
                    </p>
                  </div>
                </div>
              )}
              {app.applicationType === "RENEWAL" &&
                app.documents.oldPassport && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-xs font-bold">
                      PDF
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        Old Passport Scan
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {app.documents.oldPassport}
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </section>

          {/* Action */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={onApprove}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Final Approval — Process for Issuance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Approval Confirmation Modal ──────────────────────────────────────────────

const ApproveConfirmModal = ({
  trackingNumber,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  trackingNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-2">
        Confirm Final Approval
      </h3>
      <p className="text-gray-600 text-sm mb-6">
        Approve application{" "}
        <span className="font-mono font-semibold text-gray-800">
          {trackingNumber}
        </span>{" "}
        for passport issuance? This will mark the application as processed.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isProcessing}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Processing…" : "Confirm Approval"}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const OfficerDashboard = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const [queue, setQueue] = useState<EnrichedApplication[]>([]);
  const [selectedItem, setSelectedItem] = useState<EnrichedApplication | null>(
    null,
  );
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate("/authorized-login");
      return;
    }
    if (currentUser.role !== "officer") {
      authService.logout();
      navigate("/authorized-login");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (currentUser?.role === "officer") {
      officerService
        .getProcessingQueueFull(currentUser.user.id)
        .then(setQueue);
    }
  }, [currentUser]);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
    },
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const handleApprove = async () => {
    if (!selectedItem || !currentUser) return;
    setIsProcessing(true);

    await officerService.approveApplication(
      currentUser.user.id,
      selectedItem.app.applicationId,
    );

    setQueue((prev) =>
      prev.filter(
        (e) => e.app.applicationId !== selectedItem.app.applicationId,
      ),
    );

    setIsProcessing(false);
    setShowApproveConfirm(false);

    // FR-19: for RENEWAL applications, prompt old passport cancellation
    if (selectedItem.app.applicationType === "RENEWAL") {
      setCancelDone(false);
      setShowCancelModal(true);
    } else {
      showToast(
        `Application ${selectedItem.app.trackingNumber} approved for issuance.`,
        "success",
      );
      setSelectedItem(null);
    }
  };

  const handleCancelOldPassport = async () => {
    if (!selectedItem || !currentUser) return;
    setIsProcessing(true);

    await officerService.cancelOldPassport(
      currentUser.user.id,
      selectedItem.app.applicationId,
      selectedItem.app.trackingNumber,
    );

    setCancelDone(true);
    setIsProcessing(false);
    showToast(
      `Application ${selectedItem.app.trackingNumber} approved. Old passport record cancelled.`,
      "success",
    );
  };

  const handleCancelModalDone = () => {
    setShowCancelModal(false);
    setCancelDone(false);
    setSelectedItem(null);
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/");
  };

  if (!currentUser || currentUser.role !== "officer") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-800 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              General Security Officer Portal
            </h1>
            <p className="text-xs text-gray-400">
              National Passport Issuance System
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">
              {currentUser.user.fullName}
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Applications Awaiting Final Processing
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Mukhtar-endorsed applications ready for issuance approval
            </p>
          </div>

          <div className="p-6">
            {queue.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <svg
                  className="w-12 h-12 text-gray-300 mx-auto mb-4"
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
                <p className="text-gray-500 font-medium">
                  No applications awaiting final processing.
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Applications signed by a mukhtar will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((item) => {
                  const sig = officerService.getSignatureForApplication(
                    item.app.applicationId,
                  );
                  return (
                    <QueueCard
                      key={item.app.applicationId}
                      item={item}
                      signedAt={sig?.timestamp ?? null}
                      onClick={() => setSelectedItem(item)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && !showApproveConfirm && !showCancelModal && (
        <DetailModal
          item={selectedItem}
          signature={officerService.getSignatureForApplication(
            selectedItem.app.applicationId,
          )}
          onClose={() => setSelectedItem(null)}
          onApprove={() => setShowApproveConfirm(true)}
        />
      )}

      {/* Approval Confirmation Modal */}
      {selectedItem && showApproveConfirm && (
        <ApproveConfirmModal
          trackingNumber={selectedItem.app.trackingNumber}
          onConfirm={handleApprove}
          onCancel={() => setShowApproveConfirm(false)}
          isProcessing={isProcessing}
        />
      )}

      {/* Old Passport Cancellation Modal (FR-19, RENEWAL only) */}
      {selectedItem && showCancelModal && (
        <CancelOldPassportModal
          trackingNumber={selectedItem.app.trackingNumber}
          onConfirm={handleCancelOldPassport}
          onSkip={handleCancelModalDone}
          isProcessing={isProcessing}
          cancelled={cancelDone}
        />
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onDismiss={dismissToast} />}
    </div>
  );
};

export default OfficerDashboard;
