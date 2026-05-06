import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type ApplicationType = "NEW" | "RENEWAL";

interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
}

const NEW_ITEMS: ChecklistItem[] = [
  {
    id: "id_or_extract",
    title: "Lebanese National ID Card or Civil Registry Extract",
    detail:
      "Issued less than 3 months ago. The QR code on the document must be scannable.",
  },
  {
    id: "passport_photo",
    title: "Passport Photo",
    detail:
      "3.5 × 4.5 cm, white background, face clearly visible with no obstructions.",
  },
  {
    id: "camera",
    title: "Device with a front-facing camera",
    detail:
      "Required for the in-app biometric capture step at the end of the application.",
  },
];

const RENEWAL_ITEMS: ChecklistItem[] = [
  {
    id: "id_or_extract",
    title: "Lebanese National ID Card or Civil Registry Extract",
    detail: "Issued less than 3 months ago.",
  },
  {
    id: "passport_photo",
    title: "Passport Photo",
    detail:
      "3.5 × 4.5 cm, white background, face clearly visible with no obstructions.",
  },
  {
    id: "old_passport",
    title: "Your current (old) passport",
    detail:
      "The MRZ at the bottom must be legible, and the passport must not be reported lost or stolen.",
  },
];

const PreApplicationChecklistPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetType = searchParams.get("type");
  const fromExpiry = searchParams.get("fromExpiry");
  const initialTab: ApplicationType = presetType === "RENEWAL" ? "RENEWAL" : "NEW";
  const [activeTab, setActiveTab] = useState<ApplicationType>(initialTab);
  // Independent checked state per tab so switching tabs doesn't lose progress
  const [checkedNew, setCheckedNew] = useState<Record<string, boolean>>({});
  const [checkedRenewal, setCheckedRenewal] = useState<Record<string, boolean>>(
    {},
  );

  const items = activeTab === "NEW" ? NEW_ITEMS : RENEWAL_ITEMS;
  const checked = activeTab === "NEW" ? checkedNew : checkedRenewal;
  const setChecked = activeTab === "NEW" ? setCheckedNew : setCheckedRenewal;

  const allChecked = useMemo(
    () => items.every((item) => checked[item.id]),
    [items, checked],
  );

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const TabButton = ({
    type,
    label,
  }: {
    type: ApplicationType;
    label: string;
  }) => {
    const isActive = activeTab === type;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(type)}
        className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
          isActive
            ? "border-blue-600 text-blue-700 bg-blue-50/50"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={() => navigate("/citizen/dashboard")}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            ← Back to dashboard
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">
              Before you start
            </h1>
            <p className="text-gray-600 mt-1">
              Take a moment to gather what you'll need. Having everything ready
              keeps your application moving without interruptions.
            </p>
          </div>

          <div className="flex border-b border-gray-200">
            <TabButton type="NEW" label="New Passport" />
            <TabButton type="RENEWAL" label="Passport Renewal" />
          </div>

          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              What you'll need
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Tick each item once you have it ready.
            </p>

            <ul className="space-y-3">
              {items.map((item) => {
                const isChecked = !!checked[item.id];
                return (
                  <li key={item.id}>
                    <label
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? "border-green-300 bg-green-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(item.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium ${
                            isChecked ? "text-green-800" : "text-gray-800"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p
                          className={`text-sm mt-0.5 ${
                            isChecked ? "text-green-700" : "text-gray-600"
                          }`}
                        >
                          {item.detail}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2">
              <svg
                className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-blue-800">
                You can save and return to your application at any point — but
                preparing these items in advance is the fastest path to
                submission.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({ type: activeTab });
                if (fromExpiry) params.set("fromExpiry", fromExpiry);
                navigate(`/application/new?${params.toString()}`);
              }}
              disabled={!allChecked}
              className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {allChecked
                ? "I'm Ready — Start Application"
                : "Tick all items to continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreApplicationChecklistPage;
