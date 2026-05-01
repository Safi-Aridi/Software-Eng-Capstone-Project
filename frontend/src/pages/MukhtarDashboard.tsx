import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { mukhtarService } from "../services/mukhtarService";
import type { EnrichedApplication } from "../services/applicationService";

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
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
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

// ─── Application Queue Card ───────────────────────────────────────────────────

const QueueCard = ({
  item,
  onClick,
}: {
  item: EnrichedApplication;
  onClick: () => void;
}) => {
  const { app, citizenIdentity } = item;
  const citizenName = citizenIdentity?.fullName ?? "Unknown Citizen";
  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">{citizenName}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {app.applicationType === "NEW" ? "New Passport" : "Passport Renewal"}{" "}
            &mdash; {app.mukhtarFormData.district}
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            {app.trackingNumber}
          </p>
          <p className="text-xs text-gray-400">
            Submitted:{" "}
            {new Date(app.submissionDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={app.currentStatus} />
          <span className="text-xs text-blue-600 font-medium">Review →</span>
        </div>
      </div>
    </div>
  );
};

// ─── Document Row ─────────────────────────────────────────────────────────────

const DocRow = ({ label, name }: { label: string; name: string | null }) => {
  if (!name) return null;
  const isImage = /\.(jpg|jpeg|png)$/i.test(name);
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-xs font-bold">
        {isImage ? "IMG" : "PDF"}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 font-mono">{name}</p>
      </div>
    </div>
  );
};

// ─── Confirmation Modal ───────────────────────────────────────────────────────

const ConfirmModal = ({
  action,
  trackingNumber,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  action: "sign" | "reject";
  trackingNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) => {
  const isSigning = action === "sign";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          {isSigning ? "Apply Electronic Signature" : "Request Resubmission"}
        </h3>
        <p className="text-gray-600 text-sm mb-6">
          {isSigning ? (
            <>
              You are about to apply your electronic signature to application{" "}
              <span className="font-mono font-semibold text-gray-800">
                {trackingNumber}
              </span>
              . This action cannot be undone.
            </>
          ) : (
            <>
              You are requesting document resubmission for application{" "}
              <span className="font-mono font-semibold text-gray-800">
                {trackingNumber}
              </span>
              . The citizen will be notified.
            </>
          )}
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
            className={`px-4 py-2 text-white rounded-md transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed ${
              isSigning
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-yellow-600 hover:bg-yellow-700"
            }`}
          >
            {isProcessing
              ? "Processing…"
              : isSigning
                ? "Confirm & Sign"
                : "Confirm Resubmission"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal = ({
  item,
  onClose,
  onSign,
  onReject,
}: {
  item: EnrichedApplication;
  onClose: () => void;
  onSign: () => void;
  onReject: () => void;
}) => {
  const { app, citizenIdentity } = item;
  const dob =
    citizenIdentity?.dateOfBirth ?? citizenIdentity?.dob ?? "—";

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 mb-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Application Review
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
                <p className="text-gray-500">Document Type</p>
                <p className="font-medium text-gray-800">
                  {citizenIdentity?.documentType ?? "Lebanese ID Card"}
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
              <div>
                <p className="text-gray-500">Address</p>
                <p className="font-medium text-gray-800">
                  {app.mukhtarFormData.address}
                </p>
              </div>
              <div>
                <p className="text-gray-500">District</p>
                <p className="font-medium text-gray-800">
                  {app.mukhtarFormData.district}
                </p>
              </div>
            </div>
          </section>

          {/* Documents */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Submitted Documents
            </h3>
            <div className="space-y-2">
              <DocRow
                label="Identity Document"
                name={app.documents.identityDocument}
              />
              <DocRow
                label="Passport Photo"
                name={app.documents.passportPhoto}
              />
              {app.applicationType === "RENEWAL" && (
                <DocRow
                  label="Old Passport Scan"
                  name={app.documents.oldPassport}
                />
              )}
            </div>
          </section>

          {/* Legal Notice */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-xs">
              Under Law No. 81/2018, your electronic signature holds the same
              legal weight as a physical signature. Review all information
              carefully before signing.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              onClick={onReject}
              className="px-5 py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md hover:bg-yellow-200 transition-colors text-sm font-medium"
            >
              Request Resubmission
            </button>
            <button
              onClick={onSign}
              className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Approve &amp; Sign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const MukhtarDashboard = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const [queue, setQueue] = useState<EnrichedApplication[]>([]);
  const [selectedItem, setSelectedItem] = useState<EnrichedApplication | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<"sign" | "reject" | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate("/authorized-login");
      return;
    }
    if (currentUser.role !== "mukhtar") {
      authService.logout();
      navigate("/authorized-login");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (currentUser?.role === "mukhtar") {
      mukhtarService
        .getPendingApplicationsFull(currentUser.user.id)
        .then(setQueue);
    }
  }, [currentUser]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const handleSign = async () => {
    if (!selectedItem || !currentUser) return;
    setIsProcessing(true);

    // 5% simulated cryptographic failure (FR-15)
    if (Math.random() < 0.05) {
      setIsProcessing(false);
      setConfirmAction(null);
      showToast(
        "Cryptographic signature failed. Please try again.",
        "error",
      );
      return;
    }

    await mukhtarService.signApplication(
      currentUser.user.id,
      selectedItem.app.applicationId,
    );

    setQueue((prev) =>
      prev.filter(
        (e) => e.app.applicationId !== selectedItem.app.applicationId,
      ),
    );
    showToast(
      `Application ${selectedItem.app.trackingNumber} signed successfully.`,
      "success",
    );
    setIsProcessing(false);
    setConfirmAction(null);
    setSelectedItem(null);
  };

  const handleReject = async () => {
    if (!selectedItem || !currentUser) return;
    setIsProcessing(true);

    await mukhtarService.rejectApplication(
      currentUser.user.id,
      selectedItem.app.applicationId,
    );

    setQueue((prev) =>
      prev.filter(
        (e) => e.app.applicationId !== selectedItem.app.applicationId,
      ),
    );
    showToast(
      `Resubmission requested for ${selectedItem.app.trackingNumber}.`,
      "success",
    );
    setIsProcessing(false);
    setConfirmAction(null);
    setSelectedItem(null);
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/");
  };

  if (!currentUser || currentUser.role !== "mukhtar") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-800 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold tracking-wide">Mukhtar Portal</h1>
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
        {/* Legal notice */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm">
            <span className="font-semibold">Legal Notice:</span> Under Law No.
            81/2018, your electronic signature holds the same legal weight as a
            physical signature. Review all applicant information carefully before
            taking action.
          </p>
        </div>

        {/* Queue */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Pending Applications Queue
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Applications verified by the system and awaiting your endorsement
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
                  No pending applications in your jurisdiction.
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  New applications will appear here once verified by the system.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((item) => (
                  <QueueCard
                    key={item.app.applicationId}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && !confirmAction && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSign={() => setConfirmAction("sign")}
          onReject={() => setConfirmAction("reject")}
        />
      )}

      {/* Confirmation Modal */}
      {selectedItem && confirmAction && (
        <ConfirmModal
          action={confirmAction}
          trackingNumber={selectedItem.app.trackingNumber}
          onConfirm={confirmAction === "sign" ? handleSign : handleReject}
          onCancel={() => setConfirmAction(null)}
          isProcessing={isProcessing}
        />
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onDismiss={dismissToast} />}
    </div>
  );
};

export default MukhtarDashboard;
