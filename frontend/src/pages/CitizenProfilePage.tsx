import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

interface IdentityData {
  fullName?: string;
  registryNumber?: string;
  dateOfBirth?: string;
  dob?: string;
}

const formatDate = (raw?: string): string => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const ReadOnlyRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-800">{value}</span>
  </div>
);

const EditableRow = ({
  label,
  value,
  onSave,
  inputType = "text",
}: {
  label: string;
  value: string;
  onSave: (newValue: string) => { success: boolean; message?: string };
  inputType?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");

  // Reset draft if external value changes (e.g. after a save)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const handleCancel = () => {
    setDraft(value);
    setError("");
    setEditing(false);
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("This field cannot be empty.");
      return;
    }
    const result = onSave(trimmed);
    if (!result.success) {
      setError(result.message ?? "Failed to save.");
      return;
    }
    setError("");
    setEditing(false);
  };

  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex justify-between items-center gap-3">
        <span className="text-sm text-gray-500 shrink-0">{label}</span>
        {editing ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <input
              type={inputType}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSave}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors font-medium shrink-0"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300 transition-colors font-medium shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-800">{value}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              Edit
            </button>
          </div>
        )}
      </div>
      {editing && error && (
        <p className="text-xs text-red-600 mt-1.5">{error}</p>
      )}
    </div>
  );
};

const CitizenProfilePage = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const [email, setEmail] = useState(currentUser?.user.email ?? "");
  const [mobileNumber, setMobileNumber] = useState(
    currentUser?.user.mobileNumber ?? "",
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  const identity = (authService.getSavedIdentityData() ?? {}) as IdentityData;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleSaveEmail = (next: string) => {
    const result = authService.updateContactInfo({ email: next });
    if (result.success) {
      setEmail(next);
      showToast("Saved successfully");
    }
    return result;
  };

  const handleSaveMobile = (next: string) => {
    const result = authService.updateContactInfo({ mobileNumber: next });
    if (result.success) {
      setMobileNumber(next);
      showToast("Saved successfully");
    }
    return result;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate("/citizen/dashboard")}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            ← Back to dashboard
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-1">My Profile</h1>
        <p className="text-gray-600 mb-6">
          Your verified identity and contact details on file.
        </p>

        {/* Identity Information — read-only */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                Identity Information
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Verified during identity verification — cannot be edited here.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Verified
            </span>
          </div>
          <div className="px-6 py-2">
            <ReadOnlyRow
              label="Full Name"
              value={identity.fullName || currentUser.user.fullName || "—"}
            />
            <ReadOnlyRow
              label="National Registry Number"
              value={identity.registryNumber || "—"}
            />
            <ReadOnlyRow
              label="Date of Birth"
              value={formatDate(identity.dateOfBirth || identity.dob)}
            />
          </div>
        </div>

        {/* Contact Information — editable */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">
              Contact Information
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              We use these to send you notifications and OTP codes.
            </p>
          </div>
          <div className="px-6 py-2">
            <EditableRow
              label="Email"
              value={email || "—"}
              inputType="email"
              onSave={handleSaveEmail}
            />
            <EditableRow
              label="Mobile Number"
              value={mobileNumber || "—"}
              inputType="tel"
              onSave={handleSaveMobile}
            />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in"
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default CitizenProfilePage;
