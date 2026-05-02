import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  type PassportApplication,
} from "../services/applicationService";
import EnhancedFileUploadField from "../components/upload/EnhancedFileUploadField";

type ApplicationType = "NEW" | "RENEWAL";
type ValidityYears = 5 | 10;

interface DocumentFiles {
  identityDocument: File | null;
  passportPhoto: File | null;
  oldPassport: File | null;
}

interface MukhtarForm {
  address: string;
  district: string;
  mukhtarName: string;
}

const FEE_MAP: Record<ValidityYears, number> = { 5: 200_000, 10: 350_000 };

const STEP_LABELS = [
  "Type",
  "Details",
  "Documents",
  "Mukhtar & Biometrics",
  "Review",
];

const ALLOWED_DOC_EXTS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_PHOTO_EXTS = ["jpg", "jpeg", "png"];

const getExt = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isValidDoc = (f: File) => ALLOWED_DOC_EXTS.includes(getExt(f));
const isValidPhoto = (f: File) => ALLOWED_PHOTO_EXTS.includes(getExt(f));

// ─── Main Page ───────────────────────────────────────────────────────────────

const NewPassportApplicationPage = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const [step, setStep] = useState(1);
  const [applicationType, setApplicationType] = useState<ApplicationType | null>(null);
  const [passportValidity, setPassportValidity] = useState<ValidityYears | null>(null);
  const [documents, setDocuments] = useState<DocumentFiles>({
    identityDocument: null,
    passportPhoto: null,
    oldPassport: null,
  });
  const [mukhtarForm, setMukhtarForm] = useState<MukhtarForm>({
    address: "",
    district: "",
    mukhtarName: "",
  });
  const [biometricCaptured, setBiometricCaptured] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser || currentUser.role !== "citizen") {
    navigate("/");
    return null;
  }

  if (currentUser.accountStatus !== "ACTIVE") {
    navigate("/citizen/dashboard");
    return null;
  }

  const goNext = () => {
    const errs: Record<string, string> = {};

    if (step === 1 && !applicationType) {
      errs.type = "Please select an application type.";
    }
    if (step === 2 && !passportValidity) {
      errs.validity = "Please select a passport validity period.";
    }
    if (step === 3) {
      if (!documents.identityDocument)
        errs.identityDocument = "Identity document is required.";
      if (!documents.passportPhoto)
        errs.passportPhoto = "Passport photo is required.";
      if (applicationType === "RENEWAL" && !documents.oldPassport)
        errs.oldPassport = "Old passport scan is required for renewal applications.";
    }
    if (step === 4) {
      if (!mukhtarForm.address.trim()) errs.address = "Address is required.";
      if (!mukhtarForm.district.trim()) errs.district = "District / Qada is required.";
      if (!mukhtarForm.mukhtarName.trim())
        errs.mukhtarName = "Mukhtar's name is required.";
      if (applicationType === "NEW" && !biometricCaptured)
        errs.biometric = "Biometric capture must be completed before proceeding.";
    }

    if (Object.keys(errs).length > 0) {
      setStepErrors(errs);
      return;
    }

    setStepErrors({});
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setStepErrors({});
    setStep((s) => s - 1);
  };

  // Type validation now lives inside EnhancedFileUploadField; parent only stores the accepted file.
  const handleFileChange = (field: keyof DocumentFiles, file: File | null) => {
    setDocuments((prev) => ({ ...prev, [field]: file }));
    if (file) setStepErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const clearFile = (field: keyof DocumentFiles) => {
    setDocuments((prev) => ({ ...prev, [field]: null }));
  };

  const handleMukhtarChange = (field: keyof MukhtarForm, value: string) => {
    setMukhtarForm((prev) => ({ ...prev, [field]: value }));
    if (value.trim()) setStepErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const trackingNumber = applicationService.generateTrackingNumber();
    const application: PassportApplication = {
      applicationId: "app_" + Date.now(),
      userId: currentUser.user.id,
      applicationType: applicationType!,
      currentStatus: "PENDING_REVIEW",
      submissionDate: new Date().toISOString(),
      trackingNumber,
      passportValidity: passportValidity!,
      feeAmount: FEE_MAP[passportValidity!],
      documents: {
        identityDocument: documents.identityDocument?.name ?? null,
        passportPhoto: documents.passportPhoto?.name ?? null,
        oldPassport: documents.oldPassport?.name ?? null,
      },
      mukhtarFormData: mukhtarForm,
      biometricCaptured,
    };

    // TODO: Replace with POST /api/applications when backend is ready
    await applicationService.createApplication(currentUser.user.id, application);
    setIsSubmitting(false);
    navigate("/citizen/dashboard", {
      state: {
        successMessage: `Application submitted! Your tracking number is ${trackingNumber}.`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Passport Application
          </h1>
          <p className="text-gray-600 mt-1">
            Complete all steps to submit your application
          </p>
        </div>

        <ProgressBar currentStep={step} labels={STEP_LABELS} />

        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          {step === 1 && (
            <Step1TypeSelection
              selected={applicationType}
              onSelect={(t) => {
                setApplicationType(t);
                setStepErrors({});
              }}
              error={stepErrors.type}
            />
          )}
          {step === 2 && (
            <Step2PassportDetails
              validity={passportValidity}
              onSelect={(v) => {
                setPassportValidity(v);
                setStepErrors({});
              }}
              error={stepErrors.validity}
            />
          )}
          {step === 3 && (
            <Step3Documents
              applicationType={applicationType!}
              documents={documents}
              stepErrors={stepErrors}
              onFileChange={handleFileChange}
              onClearFile={clearFile}
            />
          )}
          {step === 4 && (
            <Step4MukhtarBiometrics
              applicationType={applicationType!}
              mukhtarForm={mukhtarForm}
              onMukhtarChange={handleMukhtarChange}
              biometricCaptured={biometricCaptured}
              onBiometricCapture={() => {
                setBiometricCaptured(true);
                setStepErrors((p) => ({ ...p, biometric: "" }));
              }}
              errors={stepErrors}
            />
          )}
          {step === 5 && (
            <Step5Review
              applicationType={applicationType!}
              passportValidity={passportValidity!}
              feeAmount={FEE_MAP[passportValidity!]}
              documents={documents}
              mukhtarForm={mukhtarForm}
              biometricCaptured={biometricCaptured}
            />
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-4 border-t border-gray-200">
            {step > 1 ? (
              <button
                onClick={goBack}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}
            {step < 5 ? (
              <button
                onClick={goNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar = ({
  currentStep,
  labels,
}: {
  currentStep: number;
  labels: string[];
}) => (
  <div className="flex items-start">
    {labels.map((label, idx) => {
      const num = idx + 1;
      const done = num < currentStep;
      const active = num === currentStep;
      return (
        <div key={num} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${done ? "bg-green-600 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}
            >
              {done ? "✓" : num}
            </div>
            <span
              className={`text-xs mt-1 text-center leading-tight w-14
                ${active ? "text-blue-600 font-medium" : done ? "text-green-600" : "text-gray-400"}`}
            >
              {label}
            </span>
          </div>
          {idx < labels.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1 mb-5 ${done ? "bg-green-400" : "bg-gray-200"}`}
            />
          )}
        </div>
      );
    })}
  </div>
);

// ─── Step 1: Type Selection ───────────────────────────────────────────────────

const Step1TypeSelection = ({
  selected,
  onSelect,
  error,
}: {
  selected: ApplicationType | null;
  onSelect: (t: ApplicationType) => void;
  error?: string;
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-1">
      Select Application Type
    </h2>
    <p className="text-gray-500 text-sm mb-6">
      Choose whether you are applying for a new passport or renewing an existing
      one.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {(["NEW", "RENEWAL"] as const).map((type) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className={`p-6 rounded-lg border-2 text-left transition-all
            ${selected === type
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
            }`}
        >
          <div className="text-3xl mb-3">{type === "NEW" ? "🛂" : "🔄"}</div>
          <div className="font-semibold text-gray-800">
            {type === "NEW" ? "New Passport" : "Passport Renewal"}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {type === "NEW"
              ? "Apply for your first Lebanese passport"
              : "Renew your existing Lebanese passport"}
          </div>
          {selected === type && (
            <div className="mt-3 text-blue-600 text-sm font-medium">
              ✓ Selected
            </div>
          )}
        </button>
      ))}
    </div>

    {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
  </div>
);

// ─── Step 2: Passport Details ─────────────────────────────────────────────────

const Step2PassportDetails = ({
  validity,
  onSelect,
  error,
}: {
  validity: ValidityYears | null;
  onSelect: (v: ValidityYears) => void;
  error?: string;
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-1">
      Passport Details
    </h2>
    <p className="text-gray-500 text-sm mb-6">
      Select the validity period for your passport.
    </p>

    <div className="space-y-3">
      {([5, 10] as const).map((years) => (
        <label
          key={years}
          className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all
            ${validity === years
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 hover:border-blue-300"
            }`}
        >
          <input
            type="radio"
            name="validity"
            value={years}
            checked={validity === years}
            onChange={() => onSelect(years)}
            className="mr-3 accent-blue-600"
          />
          <div>
            <div className="font-medium text-gray-800">{years}-Year Passport</div>
            <div className="text-sm text-gray-500">
              Valid for {years} years from issue date
            </div>
          </div>
        </label>
      ))}
    </div>

    {validity && (
      <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-blue-800 font-medium">Applicable Fee</span>
          <span className="text-blue-900 font-bold text-lg">
            {FEE_MAP[validity].toLocaleString()} LBP
          </span>
        </div>
        <p className="text-blue-600 text-xs mt-1">
          Fee is payable at the time of collection
        </p>
      </div>
    )}

    {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
  </div>
);

// ─── Step 3: Document Upload ──────────────────────────────────────────────────

const Step3Documents = ({
  applicationType,
  documents,
  stepErrors,
  onFileChange,
  onClearFile,
}: {
  applicationType: ApplicationType;
  documents: DocumentFiles;
  stepErrors: Record<string, string>;
  onFileChange: (field: keyof DocumentFiles, file: File | null) => void;
  onClearFile: (field: keyof DocumentFiles) => void;
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-1">
      Document Upload
    </h2>
    <p className="text-gray-500 text-sm mb-6">
      Drag & drop or choose your documents. Image files will show a preview
      after upload.
    </p>

    <div className="space-y-5">
      <EnhancedFileUploadField
        id="identityDocument"
        label="Identity Document"
        accept=".pdf,.jpg,.jpeg,.png"
        acceptLabel="PDF, JPG, PNG"
        file={documents.identityDocument}
        stepError={stepErrors.identityDocument}
        required
        validator={isValidDoc}
        typeErrorMsg="Only PDF, JPG, and PNG files are accepted."
        onChange={(f) => onFileChange("identityDocument", f)}
        onClear={() => onClearFile("identityDocument")}
      />

      <EnhancedFileUploadField
        id="passportPhoto"
        label="Passport Photo"
        accept=".jpg,.jpeg,.png"
        acceptLabel="JPG, PNG"
        file={documents.passportPhoto}
        stepError={stepErrors.passportPhoto}
        required
        validator={isValidPhoto}
        typeErrorMsg="Only JPG and PNG files are accepted for passport photos."
        onChange={(f) => onFileChange("passportPhoto", f)}
        onClear={() => onClearFile("passportPhoto")}
      />

      {applicationType === "RENEWAL" && (
        <EnhancedFileUploadField
          id="oldPassport"
          label="Old Passport Scan"
          accept=".pdf,.jpg,.jpeg,.png"
          acceptLabel="PDF, JPG, PNG"
          file={documents.oldPassport}
          stepError={stepErrors.oldPassport}
          required
          validator={isValidDoc}
          typeErrorMsg="Only PDF, JPG, and PNG files are accepted."
          onChange={(f) => onFileChange("oldPassport", f)}
          onClear={() => onClearFile("oldPassport")}
        />
      )}
    </div>
  </div>
);

// ─── Step 4: Mukhtar Form & Biometrics ───────────────────────────────────────

const Step4MukhtarBiometrics = ({
  applicationType,
  mukhtarForm,
  onMukhtarChange,
  biometricCaptured,
  onBiometricCapture,
  errors,
}: {
  applicationType: ApplicationType;
  mukhtarForm: MukhtarForm;
  onMukhtarChange: (field: keyof MukhtarForm, value: string) => void;
  biometricCaptured: boolean;
  onBiometricCapture: () => void;
  errors: Record<string, string>;
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-1">
      Mukhtar Information{applicationType === "NEW" ? " & Biometrics" : ""}
    </h2>
    <p className="text-gray-500 text-sm mb-6">
      Provide your mukhtar's details
      {applicationType === "NEW" ? " and complete biometric capture" : ""}.
    </p>

    <div className="space-y-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={mukhtarForm.address}
          onChange={(e) => onMukhtarChange("address", e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.address ? "border-red-400" : "border-gray-300"}`}
          placeholder="Enter your full address"
        />
        {errors.address && (
          <p className="text-red-600 text-xs mt-1">{errors.address}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          District / Qada <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={mukhtarForm.district}
          onChange={(e) => onMukhtarChange("district", e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.district ? "border-red-400" : "border-gray-300"}`}
          placeholder="Enter your district or qada"
        />
        {errors.district && (
          <p className="text-red-600 text-xs mt-1">{errors.district}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mukhtar's Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={mukhtarForm.mukhtarName}
          onChange={(e) => onMukhtarChange("mukhtarName", e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.mukhtarName ? "border-red-400" : "border-gray-300"}`}
          placeholder="Enter your mukhtar's full name"
        />
        {errors.mukhtarName && (
          <p className="text-red-600 text-xs mt-1">{errors.mukhtarName}</p>
        )}
      </div>
    </div>

    {applicationType === "NEW" && (
      <div
        className={`p-5 rounded-lg border-2 ${biometricCaptured ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"}`}
      >
        <h3 className="font-semibold text-gray-800 mb-1">Biometric Capture</h3>
        <p className="text-gray-600 text-sm mb-4">
          Biometric data is required for all new passport applications.
        </p>
        {/* TODO: Replace with real biometric capture component (FR-07) */}
        {biometricCaptured ? (
          <div className="flex items-center text-green-700 font-medium">
            <span className="mr-2 text-xl">✓</span> Biometric capture complete
          </div>
        ) : (
          <>
            <button
              onClick={onBiometricCapture}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              Start Biometric Capture (Simulated)
            </button>
            {errors.biometric && (
              <p className="text-red-600 text-xs mt-2">{errors.biometric}</p>
            )}
          </>
        )}
      </div>
    )}
  </div>
);

// ─── Step 5: Review & Submit ──────────────────────────────────────────────────

const Step5Review = ({
  applicationType,
  passportValidity,
  feeAmount,
  documents,
  mukhtarForm,
  biometricCaptured,
}: {
  applicationType: ApplicationType;
  passportValidity: ValidityYears;
  feeAmount: number;
  documents: DocumentFiles;
  mukhtarForm: MukhtarForm;
  biometricCaptured: boolean;
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-1">
      Review & Submit
    </h2>
    <p className="text-gray-500 text-sm mb-6">
      Please review your application details before submitting.
    </p>

    <div className="space-y-4">
      <ReviewSection title="Application Type">
        <ReviewRow
          label="Type"
          value={applicationType === "NEW" ? "New Passport" : "Passport Renewal"}
        />
      </ReviewSection>

      <ReviewSection title="Passport Details">
        <ReviewRow label="Validity" value={`${passportValidity} Years`} />
        <ReviewRow label="Fee" value={`${feeAmount.toLocaleString()} LBP`} />
      </ReviewSection>

      <ReviewSection title="Documents">
        <ReviewRow
          label="Identity Document"
          value={documents.identityDocument?.name ?? "—"}
        />
        <ReviewRow
          label="Passport Photo"
          value={documents.passportPhoto?.name ?? "—"}
        />
        {applicationType === "RENEWAL" && (
          <ReviewRow
            label="Old Passport Scan"
            value={documents.oldPassport?.name ?? "—"}
          />
        )}
      </ReviewSection>

      <ReviewSection title="Mukhtar Information">
        <ReviewRow label="Address" value={mukhtarForm.address} />
        <ReviewRow label="District / Qada" value={mukhtarForm.district} />
        <ReviewRow label="Mukhtar's Name" value={mukhtarForm.mukhtarName} />
      </ReviewSection>

      {applicationType === "NEW" && (
        <ReviewSection title="Biometrics">
          <ReviewRow
            label="Biometric Capture"
            value={biometricCaptured ? "Completed" : "Not captured"}
          />
        </ReviewSection>
      )}
    </div>

    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-yellow-800 text-sm">
        By submitting this application, you confirm that all provided
        information is accurate and complete. Providing false information may
        result in rejection.
      </p>
    </div>
  </div>
);

const ReviewSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden">
    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
      <h3 className="font-medium text-gray-700 text-sm">{title}</h3>
    </div>
    <div className="p-4 space-y-2">{children}</div>
  </div>
);

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm gap-4">
    <span className="text-gray-500 shrink-0">{label}</span>
    <span className="text-gray-800 font-medium text-right break-all">
      {value}
    </span>
  </div>
);

export default NewPassportApplicationPage;
