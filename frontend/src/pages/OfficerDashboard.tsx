import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { officerService } from "../services/officerService";
import { passportService } from "../services/passportService";
import type { EnrichedApplication } from "../services/applicationService";
import type { Passport } from "../types/passport";
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
    MUKHTAR_SIGNED: "bg-purple-100 text-purple-800",
    PROCESSED: "bg-green-100 text-green-800",
  };
  const labels: Record<string, string> = {
    MUKHTAR_SIGNED: "Mukhtar Signed",
    PROCESSED: "Approved for Printing",
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
  detailLabel,
  onClick,
}: {
  item: EnrichedApplication;
  detailLabel: string | null;
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
            {app.applicationType === "NEW"
              ? "New Passport"
              : "Passport Renewal"}{" "}
            &mdash; {app.mukhtarFormData.district}
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            {app.trackingNumber}
          </p>
          {detailLabel && (
            <p className="text-xs text-purple-600 mt-0.5">{detailLabel}</p>
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

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

const ModalShell = ({
  onDismiss,
  children,
}: {
  onDismiss: () => void;
  children: ReactNode;
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onDismiss}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
};

// ─── Approval Detail Modal (MUKHTAR_SIGNED) ───────────────────────────────────

const ApprovalDetailModal = ({
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
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Approval Review
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
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Citizen Identity
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Full Name" value={citizenIdentity?.fullName ?? "—"} />
              <Field
                label="Registry Number"
                value={citizenIdentity?.registryNumber ?? "—"}
                mono
              />
              <Field label="Date of Birth" value={dob} />
              <Field label="District" value={app.mukhtarFormData.district} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Application Details
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field
                label="Type"
                value={
                  app.applicationType === "NEW"
                    ? "New Passport"
                    : "Passport Renewal"
                }
              />
              <Field label="Validity" value={`${app.passportValidity} Years`} />
              <Field
                label="Submission Date"
                value={new Date(app.submissionDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              <Field
                label="Fee"
                value={`${app.feeAmount.toLocaleString()} LBP`}
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Submitted Documents
            </h3>
            <div className="space-y-2">
              <DocumentLink
                label="Identity Document"
                url={app.documents.identityDocument}
              />
              <DocumentLink
                label="Passport Photo"
                url={app.documents.passportPhoto}
              />
              {app.applicationType === "RENEWAL" && (
                <DocumentLink
                  label="Old Passport Scan"
                  url={app.documents.oldPassport}
                />
              )}
            </div>
          </section>

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

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={onApprove}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Approve for Issuance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div>
    <p className="text-gray-500">{label}</p>
    <p className={`font-medium text-gray-800 ${mono ? "font-mono" : ""}`}>
      {value}
    </p>
  </div>
);

const DocumentLink = ({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) => {
  if (!url) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">Not uploaded</span>
      </div>
    );
  }

  const isUrl = /^https?:\/\//i.test(url);
  const displayName = isUrl ? url.split("/").pop() || url : url;
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg text-sm">
      <div className="min-w-0">
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 font-mono truncate">
          {displayName}
        </p>
      </div>
      {isUrl && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-purple-600 hover:text-purple-800 shrink-0"
        >
          Open
        </a>
      )}
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
  <ModalShell onDismiss={isProcessing ? () => {} : onCancel}>
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-2">
        Approve this application for issuance?
      </h3>
      <p className="text-gray-600 text-sm mb-6">
        Application{" "}
        <span className="font-mono font-semibold text-gray-800">
          {trackingNumber}
        </span>{" "}
        will be marked as approved for printing. You will issue the booklet in
        the next step.
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
  </ModalShell>
);

// ─── Issuance Detail Modal (PROCESSED) ────────────────────────────────────────

const BOOKLET_REGEX = /^LB-\d{7}$/;

const IssuanceDetailModal = ({
  item,
  oldPassport,
  onClose,
  onIssue,
  isProcessing,
}: {
  item: EnrichedApplication;
  oldPassport: Passport | null;
  onClose: () => void;
  onIssue: (bookletNumber: string) => void;
  isProcessing: boolean;
}) => {
  const { app, citizenIdentity } = item;
  const [bookletNumber, setBookletNumber] = useState("LB-");
  const [touched, setTouched] = useState(false);

  const valid = BOOKLET_REGEX.test(bookletNumber.trim());
  const isRenewal = app.applicationType === "RENEWAL";

  const handleSubmit = () => {
    setTouched(true);
    if (!valid) return;
    onIssue(bookletNumber.trim());
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 mb-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Passport Issuance
            </h2>
            <p className="text-sm font-mono text-gray-500">
              {app.trackingNumber}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={app.currentStatus} />
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Citizen
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field
                label="Full Name"
                value={citizenIdentity?.fullName ?? "—"}
              />
              <Field
                label="Registry Number"
                value={citizenIdentity?.registryNumber ?? "—"}
                mono
              />
              <Field
                label="Type"
                value={isRenewal ? "Passport Renewal" : "New Passport"}
              />
              <Field label="Validity" value={`${app.passportValidity} Years`} />
            </div>
          </section>

          {isRenewal && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="text-amber-900 text-sm font-medium mb-1">
                ⚠ Renewal — old passport will be cancelled
              </p>
              <p className="text-amber-800 text-sm">
                Issuing this passport will immediately cancel passport{" "}
                <span className="font-mono font-semibold">
                  {oldPassport?.bookletNumber ?? "on file"}
                </span>
                . This cannot be undone.
              </p>
            </div>
          )}

          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              New Passport Booklet
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Passport Booklet Number
            </label>
            <input
              type="text"
              value={bookletNumber}
              onChange={(e) =>
                setBookletNumber(e.target.value.toUpperCase())
              }
              onBlur={() => setTouched(true)}
              placeholder="LB-1234567"
              className={`w-full px-3 py-2 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                touched && !valid ? "border-red-400" : "border-gray-300"
              }`}
              disabled={isProcessing}
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: LB-XXXXXXX (2 letters, dash, 7 digits)
            </p>
            {touched && !valid && (
              <p className="text-red-600 text-xs mt-1">
                Booklet number must be in the format LB-XXXXXXX (7 digits).
              </p>
            )}
          </section>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !valid}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? "Issuing…"
                : "Issue Passport & Send for Delivery"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = "approval" | "issuance";

const OfficerDashboard = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const userId = currentUser?.user.id;
  const userRole = currentUser?.role;

  const [activeTab, setActiveTab] = useState<Tab>("approval");
  const [approvalQueue, setApprovalQueue] = useState<EnrichedApplication[]>([]);
  const [issuanceQueue, setIssuanceQueue] = useState<EnrichedApplication[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);

  const [selectedApproval, setSelectedApproval] =
    useState<EnrichedApplication | null>(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const [selectedIssuance, setSelectedIssuance] =
    useState<EnrichedApplication | null>(null);
  const [oldPassportForRenewal, setOldPassportForRenewal] =
    useState<Passport | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!userId) {
      navigate("/authorized-login");
      return;
    }
    if (userRole !== "officer") {
      authService.logout();
      navigate("/authorized-login");
    }
  }, [userId, userRole, navigate]);

  const loadQueues = useCallback((uid: string) => {
    setIsLoadingQueue(true);
    Promise.all([
      officerService.getProcessingQueueFull(uid),
      officerService.getIssuanceQueueFull(uid),
    ])
      .then(([approval, issuance]) => {
        setApprovalQueue(approval);
        setIssuanceQueue(issuance);
        setIsLoadingQueue(false);
      })
      .catch(() => setIsLoadingQueue(false));
  }, []);

  useEffect(() => {
    if (userId && userRole === "officer") {
      loadQueues(userId);
    }
  }, [userId, userRole, loadQueues]);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
    },
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const handleApprove = async () => {
    if (!selectedApproval || !currentUser) return;

    setIsProcessing(true);
    await officerService.approveApplication(
      currentUser.user.id,
      selectedApproval.app.applicationId,
    );

    setApprovalQueue((prev) =>
      prev.filter(
        (e) => e.app.applicationId !== selectedApproval.app.applicationId,
      ),
    );
    // Move into issuance queue locally so it's visible immediately on next tab.
    setIssuanceQueue((prev) => [
      ...prev,
      {
        ...selectedApproval,
        app: { ...selectedApproval.app, currentStatus: "PROCESSED" },
      },
    ]);

    showToast(
      `Application ${selectedApproval.app.trackingNumber} approved for printing.`,
      "success",
    );
    setIsProcessing(false);
    setShowApproveConfirm(false);
    setSelectedApproval(null);
  };

  const handleOpenIssuance = async (item: EnrichedApplication) => {
    setSelectedIssuance(item);
    setOldPassportForRenewal(null);
    if (
      item.app.applicationType === "RENEWAL" &&
      item.app.renewingPassportId
    ) {
      const passports = await passportService.getPassportsByUser(item.app.userId);
      const old =
        passports.find((p) => p.passportId === item.app.renewingPassportId) ??
        null;
      setOldPassportForRenewal(old);
    }
  };

  const handleIssue = async (bookletNumber: string) => {
    if (!selectedIssuance || !currentUser) return;
    setIsProcessing(true);

    const { app } = selectedIssuance;
    const isRenewal = app.applicationType === "RENEWAL";

    // 1. Create new ACTIVE passport record
    await passportService.createPassport(
      app.userId,
      app.applicationId,
      bookletNumber,
    );

    // 2. Cancel old passport for renewals
    if (isRenewal && app.renewingPassportId) {
      await passportService.cancelPassport(
        app.renewingPassportId,
        app.applicationId,
      );
    }

    // 3. Update status → ISSUED + create citizen notification
    await officerService.issueApplication(
      currentUser.user.id,
      app.applicationId,
      bookletNumber,
      { isRenewal },
    );

    // 4. Mock LibanPost manifest transmission
    // TODO: POST to LibanPost API endpoint (FR-31)
    console.log("LibanPost manifest sent:", {
      trackingNumber: app.trackingNumber,
      bookletNumber,
      citizenAddress: app.mukhtarFormData.address,
    });

    setIssuanceQueue((prev) =>
      prev.filter((e) => e.app.applicationId !== app.applicationId),
    );

    showToast(
      `Passport ${bookletNumber} issued for ${app.trackingNumber}.`,
      "success",
    );
    setIsProcessing(false);
    setSelectedIssuance(null);
    setOldPassportForRenewal(null);
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/");
  };

  if (!currentUser || currentUser.role !== "officer") return null;

  const activeQueue = activeTab === "approval" ? approvalQueue : issuanceQueue;

  return (
    <div className="min-h-screen bg-gray-50">
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
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <TabButton
              label="Pending Approval"
              count={approvalQueue.length}
              active={activeTab === "approval"}
              onClick={() => setActiveTab("approval")}
            />
            <TabButton
              label="Ready for Issuance"
              count={issuanceQueue.length}
              active={activeTab === "issuance"}
              onClick={() => setActiveTab("issuance")}
            />
          </div>

          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              {activeTab === "approval"
                ? "Applications Awaiting Approval"
                : "Applications Awaiting Issuance"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === "approval"
                ? "Mukhtar-endorsed applications ready for issuance approval."
                : "Approved applications — enter the booklet number to issue and send for delivery."}
            </p>
          </div>

          <div className="p-6">
            {isLoadingQueue ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-lg p-4 animate-pulse"
                  >
                    <div className="h-4 w-1/3 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded mb-1" />
                    <div className="h-3 w-1/4 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            ) : activeQueue.length === 0 ? (
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
                  {activeTab === "approval"
                    ? "No applications awaiting approval."
                    : "No applications awaiting issuance."}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Use the Dev Status Panel to seed applications for testing.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeQueue.map((item) => {
                  if (activeTab === "approval") {
                    const sig = officerService.getSignatureForApplication(
                      item.app.applicationId,
                    );
                    const detail = sig
                      ? `Signed: ${new Date(sig.timestamp).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}`
                      : null;
                    return (
                      <QueueCard
                        key={item.app.applicationId}
                        item={item}
                        detailLabel={detail}
                        onClick={() => setSelectedApproval(item)}
                      />
                    );
                  }
                  // Issuance tab — show the date approved (PROCESSED transition)
                  const processedAt = item.app.statusHistory?.find(
                    (h) => h.status === "PROCESSED",
                  )?.timestamp;
                  const detail = processedAt
                    ? `Approved: ${new Date(processedAt).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}`
                    : null;
                  return (
                    <QueueCard
                      key={item.app.applicationId}
                      item={item}
                      detailLabel={detail}
                      onClick={() => handleOpenIssuance(item)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Detail Modal */}
      {selectedApproval && !showApproveConfirm && (
        <ApprovalDetailModal
          item={selectedApproval}
          signature={officerService.getSignatureForApplication(
            selectedApproval.app.applicationId,
          )}
          onClose={() => setSelectedApproval(null)}
          onApprove={() => setShowApproveConfirm(true)}
        />
      )}

      {/* Approval Confirmation Modal */}
      {selectedApproval && showApproveConfirm && (
        <ApproveConfirmModal
          trackingNumber={selectedApproval.app.trackingNumber}
          onConfirm={handleApprove}
          onCancel={() => setShowApproveConfirm(false)}
          isProcessing={isProcessing}
        />
      )}

      {/* Issuance Detail Modal */}
      {selectedIssuance && (
        <IssuanceDetailModal
          item={selectedIssuance}
          oldPassport={oldPassportForRenewal}
          onClose={() => {
            if (!isProcessing) {
              setSelectedIssuance(null);
              setOldPassportForRenewal(null);
            }
          }}
          onIssue={handleIssue}
          isProcessing={isProcessing}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={dismissToast} />}
    </div>
  );
};

const TabButton = ({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
      active
        ? "border-blue-600 text-blue-700"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`}
  >
    <span>{label}</span>
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {count}
    </span>
  </button>
);

export default OfficerDashboard;
