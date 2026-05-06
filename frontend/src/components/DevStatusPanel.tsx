import { useEffect, useState } from "react";
import type { ApplicationStatus, PassportApplication } from "../services/applicationService";
import { reseedTestData } from "../services/seedTestData";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string; color: string }[] = [
  { value: "PENDING_REVIEW", label: "PENDING_REVIEW", color: "bg-gray-500" },
  { value: "VERIFIED", label: "VERIFIED", color: "bg-blue-600" },
  { value: "MUKHTAR_SIGNED", label: "MUKHTAR_SIGNED", color: "bg-purple-600" },
  { value: "PROCESSED", label: "PROCESSED", color: "bg-green-600" },
  { value: "RESUBMISSION_REQUIRED", label: "RESUBMISSION_REQUIRED", color: "bg-yellow-500" },
  { value: "DELIVERED", label: "DELIVERED", color: "bg-teal-600" },
];

const PAYMENT_OPTIONS: { value: "UNPAID" | "Paid" | "Failed"; label: string }[] = [
  { value: "UNPAID", label: "UNPAID" },
  { value: "Paid", label: "Paid" },
  { value: "Failed", label: "Failed" },
];

const loadAllApplications = (): PassportApplication[] => {
  const result: PassportApplication[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("applications_")) continue;
    try {
      const apps: PassportApplication[] = JSON.parse(localStorage.getItem(key) || "[]");
      result.push(...apps);
    } catch {
      // skip malformed
    }
  }
  return result;
};

const updateApplicationInStorage = (updated: PassportApplication): void => {
  const key = `applications_${updated.userId}`;
  try {
    const apps: PassportApplication[] = JSON.parse(localStorage.getItem(key) || "[]");
    const idx = apps.findIndex((a) => a.applicationId === updated.applicationId);
    if (idx >= 0) {
      apps[idx] = updated;
      localStorage.setItem(key, JSON.stringify(apps));
    }
  } catch {
    // skip
  }
};

const DevStatusPanel = () => {
  const [expanded, setExpanded] = useState(false);
  const [apps, setApps] = useState<PassportApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = () => {
    const loaded = loadAllApplications();
    setApps(loaded);
    if (loaded.length > 0 && !selectedId) {
      setSelectedId(loaded[0].applicationId);
    }
  };

  useEffect(() => {
    if (expanded) refresh();
  }, [expanded]);

  const selected = apps.find((a) => a.applicationId === selectedId) ?? null;

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1500);
  };

  const updateStatus = (status: ApplicationStatus) => {
    if (!selected) return;
    const updated: PassportApplication = { ...selected, currentStatus: status };
    // Seed mock per-document rejection reasons when forcing RESUBMISSION_REQUIRED,
    // so the resubmission page has something to render.
    if (status === "RESUBMISSION_REQUIRED") {
      updated.resubmissionReasons = {
        identityDocument: "Photo on ID does not match passport photo",
      };
    } else {
      updated.resubmissionReasons = undefined;
    }
    if (status === "DELIVERED" && !updated.deliveredDate) {
      updated.deliveredDate = new Date().toISOString();
    }
    updateApplicationInStorage(updated);
    setApps((prev) =>
      prev.map((a) => (a.applicationId === selectedId ? updated : a)),
    );
    showFlash("✓ Updated");
  };

  const updateDeliveredDate = (isoDate: string) => {
    if (!selected) return;
    const updated: PassportApplication = {
      ...selected,
      deliveredDate: isoDate,
      currentStatus: "DELIVERED",
    };
    // Clear info-tier dismissal so the banner re-evaluates against the new date
    localStorage.removeItem(`expiry_banner_dismissed_${selected.applicationId}`);
    updateApplicationInStorage(updated);
    setApps((prev) =>
      prev.map((a) => (a.applicationId === selectedId ? updated : a)),
    );
    showFlash("✓ Updated");
  };

  const setDeliveredOffset = (yearsAgo: number) => {
    const now = Date.now();
    const ts = new Date(now - yearsAgo * 365 * 24 * 60 * 60 * 1000).toISOString();
    updateDeliveredDate(ts);
  };

  const updatePayment = (paymentStatus: "UNPAID" | "Paid" | "Failed") => {
    if (!selected) return;
    const updated = { ...selected, paymentStatus };
    updateApplicationInStorage(updated);
    setApps((prev) =>
      prev.map((a) => (a.applicationId === selectedId ? updated : a)),
    );
    showFlash("✓ Updated");
  };

  const handleClearAll = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("applications_")) localStorage.removeItem(k);
    }
    setApps([]);
    setSelectedId("");
    setConfirmClear(false);
    showFlash("Cleared");
  };

  const handleReseed = () => {
    reseedTestData();
    refresh();
    showFlash("✓ Re-seeded");
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{ opacity: 0.6 }}
        className="fixed bottom-4 left-4 z-50 bg-gray-600 text-white text-xs px-3 py-1.5 rounded-full hover:opacity-100 transition-opacity font-mono"
      >
        ⚙ Dev Tools
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 bg-gray-900 text-gray-100 rounded-lg shadow-2xl font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <span className="font-semibold text-gray-200">Dev Controls — Status Override</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
        {/* App selector */}
        <div>
          <label className="block text-gray-400 mb-1">Application</label>
          {apps.length === 0 ? (
            <p className="text-gray-500 italic">No applications found in localStorage</p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-gray-100 rounded px-2 py-1 text-xs"
            >
              {apps.map((a) => (
                <option key={a.applicationId} value={a.applicationId}>
                  {a.trackingNumber} — {a.userId} — {a.currentStatus}
                </option>
              ))}
            </select>
          )}
        </div>

        {selected && (
          <>
            {/* Status override */}
            <div>
              <label className="block text-gray-400 mb-1">Application Status</label>
              <div className="grid grid-cols-2 gap-1">
                {STATUS_OPTIONS.map((opt) => {
                  const active = selected.currentStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updateStatus(opt.value)}
                      className={`px-2 py-1 rounded text-white text-xs transition-all
                        ${opt.color}
                        ${active ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900" : "opacity-70 hover:opacity-100"}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delivered date override (drives expiry banner) */}
            <div>
              <label className="block text-gray-400 mb-1">
                Delivered Date (sets status DELIVERED)
              </label>
              <input
                type="date"
                value={
                  selected.deliveredDate
                    ? selected.deliveredDate.slice(0, 10)
                    : ""
                }
                onChange={(e) => {
                  if (!e.target.value) return;
                  updateDeliveredDate(
                    new Date(e.target.value).toISOString(),
                  );
                }}
                className="w-full bg-gray-800 border border-gray-600 text-gray-100 rounded px-2 py-1 text-xs mb-1"
              />
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => setDeliveredOffset(4.5)}
                  className="px-1 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs"
                  title="≈ 6 months until expiry (Info)"
                >
                  -4.5y (Info)
                </button>
                <button
                  onClick={() => setDeliveredOffset(4 + 10 / 12)}
                  className="px-1 py-1 rounded bg-amber-700 hover:bg-amber-600 text-xs"
                  title="≈ 2 months until expiry (Warning)"
                >
                  -4y10m (Warn)
                </button>
                <button
                  onClick={() => setDeliveredOffset(5 + 1 / 12)}
                  className="px-1 py-1 rounded bg-red-700 hover:bg-red-600 text-xs"
                  title="Already expired (Critical)"
                >
                  -5y1m (Exp)
                </button>
              </div>
            </div>

            {/* Payment status override */}
            <div>
              <label className="block text-gray-400 mb-1">Payment Status</label>
              <div className="flex gap-1">
                {PAYMENT_OPTIONS.map((opt) => {
                  const active = selected.paymentStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updatePayment(opt.value)}
                      className={`flex-1 px-2 py-1 rounded text-xs border transition-all
                        ${active
                          ? "bg-indigo-600 border-indigo-400 text-white"
                          : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                        }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {flash && (
          <div className="text-center text-green-400 font-semibold">{flash}</div>
        )}

        {/* Quick actions */}
        <div className="border-t border-gray-700 pt-3 space-y-1.5">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-left transition-colors"
          >
            ↻ Reload Dashboard
          </button>

          {confirmClear ? (
            <div className="bg-gray-800 rounded p-2 space-y-1">
              <p className="text-yellow-400 text-xs">Are you sure? This cannot be undone.</p>
              <div className="flex gap-1">
                <button
                  onClick={handleClearAll}
                  className="flex-1 bg-red-700 hover:bg-red-600 px-2 py-1 rounded transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full bg-gray-700 hover:bg-red-900 px-3 py-1.5 rounded text-left transition-colors"
            >
              🗑 Clear All Applications
            </button>
          )}

          <button
            onClick={handleReseed}
            className="w-full bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-left transition-colors"
          >
            ⟳ Re-seed Test Data
          </button>
        </div>

        {/* Dismissal note */}
        <p className="border-t border-gray-700 pt-2 text-gray-500 text-xs leading-tight">
          This panel is only visible in development mode (import.meta.env.DEV)
        </p>
      </div>
    </div>
  );
};

export default DevStatusPanel;
