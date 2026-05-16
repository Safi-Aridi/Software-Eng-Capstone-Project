import { useEffect, useState } from "react";
import {
  inferIdentityDocumentType,
  type ApplicationStatus,
  type PassportApplication,
} from "../services/applicationService";
import { reseedTestData } from "../services/seedTestData";
import { passportService } from "../services/passportService";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string; color: string }[] = [
  { value: "PENDING_REVIEW", label: "PENDING_REVIEW", color: "bg-gray-500" },
  {
    value: "FINGERPRINT_REQUIRED",
    label: "Fingerprint Required (Branch Visit)",
    color: "bg-amber-600",
  },
  { value: "MUKHTAR_SIGNED", label: "MUKHTAR_SIGNED", color: "bg-purple-600" },
  { value: "PROCESSED", label: "PROCESSED", color: "bg-green-600" },
  { value: "ISSUED", label: "ISSUED", color: "bg-emerald-600" },
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

const generateBookletNumber = (): string => {
  const n = Math.floor(1_000_000 + Math.random() * 9_000_000);
  return `LB-${n}`;
};

// True when a passport record already exists for this application.
const hasPassportRecord = async (
  userId: string,
  applicationId: string,
): Promise<boolean> => {
  const passports = await passportService.getPassportsByUser(userId);
  return passports.some((p) => p.sourceApplicationId === applicationId);
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

  const persist = (updated: PassportApplication) => {
    updateApplicationInStorage(updated);
    setApps((prev) =>
      prev.map((a) => (a.applicationId === selectedId ? updated : a)),
    );
  };

  const updateStatus = async (status: ApplicationStatus) => {
    if (!selected) return;
    const updated: PassportApplication = { ...selected, currentStatus: status };

    if (status === "RESUBMISSION_REQUIRED") {
      const identityDocumentType =
        selected.identityDocumentType ??
        inferIdentityDocumentType(selected.documents);
      updated.resubmissionReasons =
        identityDocumentType === "NATIONAL_ID"
          ? { frontUrl: "Photo on ID does not match passport photo" }
          : identityDocumentType === "CIVIL_REGISTRY_EXTRACT"
            ? {
                civilRegistryExtract:
                  "Extract details do not match the application",
              }
            : { identityDocument: "Photo on ID does not match passport photo" };
    } else {
      updated.resubmissionReasons = undefined;
    }

    // ISSUED override — same side-effects as Officer flow:
    // create ACTIVE passport record, cancel old passport for renewals.
    if (status === "ISSUED") {
      const alreadyIssued = await hasPassportRecord(
        selected.userId,
        selected.applicationId,
      );
      if (!alreadyIssued) {
        const proposed = generateBookletNumber();
        const entered = window.prompt(
          "Enter booklet number for issued passport (LB-XXXXXXX):",
          proposed,
        );
        if (entered === null) return; // user cancelled
        const trimmed = entered.trim();
        if (!/^LB-\d{7}$/.test(trimmed)) {
          showFlash("✗ Invalid booklet number");
          return;
        }
        await passportService.createPassport(
          selected.userId,
          selected.applicationId,
          trimmed,
        );
        if (
          selected.applicationType === "RENEWAL" &&
          selected.renewingPassportId
        ) {
          await passportService.cancelPassport(
            selected.renewingPassportId,
            selected.applicationId,
          );
        }
      }
      updated.statusHistory = [
        ...(selected.statusHistory ?? []),
        { status: "ISSUED", timestamp: new Date().toISOString() },
      ];
    }

    // DELIVERED override — passport creation moved to ISSUED.
    // If dev jumped straight here without going through ISSUED, auto-create
    // a passport record so the expiry banner has data to show.
    if (status === "DELIVERED") {
      const alreadyIssued = await hasPassportRecord(
        selected.userId,
        selected.applicationId,
      );
      if (!alreadyIssued) {
        const generated = generateBookletNumber();
        console.warn(
          `[DevStatusPanel] DELIVERED override: no passport record for ${selected.applicationId}; auto-creating with booklet ${generated}.`,
        );
        await passportService.createPassport(
          selected.userId,
          selected.applicationId,
          generated,
        );
        if (
          selected.applicationType === "RENEWAL" &&
          selected.renewingPassportId
        ) {
          await passportService.cancelPassport(
            selected.renewingPassportId,
            selected.applicationId,
          );
        }
      }
      updated.statusHistory = [
        ...(selected.statusHistory ?? []),
        { status: "DELIVERED", timestamp: new Date().toISOString() },
      ];
    }

    persist(updated);
    showFlash("✓ Updated");
  };

  const updatePayment = (paymentStatus: "UNPAID" | "Paid" | "Failed") => {
    if (!selected) return;
    persist({ ...selected, paymentStatus });
    showFlash("✓ Updated");
  };

  const handleClearAll = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (
        k?.startsWith("applications_") ||
        k?.startsWith("passports_") ||
        k?.startsWith("expiry_banner_dismissed_")
      ) {
        localStorage.removeItem(k);
      }
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

        <div className="border-t border-gray-700 pt-3 space-y-1.5">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-left transition-colors"
          >
            ↻ Reload Dashboard
          </button>

          {confirmClear ? (
            <div className="bg-gray-800 rounded p-2 space-y-1">
              <p className="text-yellow-400 text-xs">Clears applications, passports, and dismissals. This cannot be undone.</p>
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
              🗑 Clear Applications & Passports
            </button>
          )}

          <button
            onClick={handleReseed}
            className="w-full bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-left transition-colors"
          >
            ⟳ Re-seed Test Data
          </button>
        </div>

        <p className="border-t border-gray-700 pt-2 text-gray-500 text-xs leading-tight">
          This panel is only visible in development mode (import.meta.env.DEV)
        </p>
      </div>
    </div>
  );
};

export default DevStatusPanel;
