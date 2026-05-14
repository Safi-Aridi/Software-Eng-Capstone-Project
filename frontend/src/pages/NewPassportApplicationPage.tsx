import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  type IdentityDocumentType,
  type PassportApplication,
} from "../services/applicationService";
import { passportService } from "../services/passportService";
import { documentService } from "../services/documentService";
import EnhancedFileUploadField from "../components/upload/EnhancedFileUploadField";
import BiometricCaptureWidget from "../components/BiometricCaptureWidget";

type ApplicationType = "NEW" | "RENEWAL";
type ValidityYears = 5 | 10;

interface DocumentFiles {
  identityDocument: File | null;
  frontUrl: File | null;
  backUrl: File | null;
  civilRegistryExtract: File | null;
  passportPhoto: File | null;
  oldPassport: File | null;
}

interface MukhtarForm {
  address: string;
  district: string;
  mukhtarName: string;
}

const FEE_MAP: Record<ValidityYears, number> = { 5: 200_000, 10: 350_000 };

const STEP_LABELS_NEW = [
  "Application Type",
  "Passport Details",
  "Document Upload",
  "Mukhtar Details",
  "Face Capture",
  "Review & Submit",
];

const STEP_LABELS_RENEWAL = [
  "Application Type",
  "Passport Details",
  "Document Upload",
  "Mukhtar Details",
  "Review & Submit",
];

const ALLOWED_DOC_EXTS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_PHOTO_EXTS = ["jpg", "jpeg", "png"];

const getExt = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isValidDoc = (f: File) => ALLOWED_DOC_EXTS.includes(getExt(f));
const isValidPhoto = (f: File) => ALLOWED_PHOTO_EXTS.includes(getExt(f));

// ─── Main Page ───────────────────────────────────────────────────────────────

const NewPassportApplicationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = authService.getCurrentUser();

  // Pre-select application type from URL (set by checklist when entering from
  // the expiry banner) — this also locks the form to step 2 and prevents the
  // Back button from returning to the type-selection step.
  const presetTypeParam = searchParams.get("type");
  const presetType: ApplicationType | null =
    presetTypeParam === "NEW" || presetTypeParam === "RENEWAL"
      ? presetTypeParam
      : null;
  const typeLocked = presetType !== null;

  const [step, setStep] = useState(typeLocked ? 2 : 1);
  const [applicationType, setApplicationType] =
    useState<ApplicationType | null>(presetType);
  const [passportValidity, setPassportValidity] =
    useState<ValidityYears | null>(null);
  const [identityDocumentType, setIdentityDocumentType] =
    useState<IdentityDocumentType>("NATIONAL_ID");
  const [documents, setDocuments] = useState<DocumentFiles>({
    identityDocument: null,
    frontUrl: null,
    backUrl: null,
    civilRegistryExtract: null,
    passportPhoto: null,
    oldPassport: null,
  });
  const [mukhtarForm, setMukhtarForm] = useState<MukhtarForm>({
    address: "",
    district: "",
    mukhtarName: "",
  });
  const [biometricCaptured, setBiometricCaptured] = useState(false);
  // For NEW applications, the row is created on the Step 4 → Step 5
  // transition so the real UUID is available to the BiometricCaptureWidget.
  // RENEWAL skips Step 5 and still creates the row at final submit.
  const [createdApplicationId, setCreatedApplicationId] = useState<
    string | null
  >(null);
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (!currentUser || currentUser.role !== "citizen") {
    navigate("/");
    return null;
  }

  if (currentUser.accountStatus !== "ACTIVE") {
    navigate("/citizen/dashboard");
    return null;
  }

  const goNext = async () => {
    const errs: Record<string, string> = {};

    if (step === 1 && !applicationType) {
      errs.type = "Please select an application type.";
    }
    if (step === 2 && !passportValidity) {
      errs.validity = "Please select a passport validity period.";
    }
    if (step === 3) {
      if (identityDocumentType === "NATIONAL_ID") {
        if (!documents.frontUrl)
          errs.frontUrl = "National ID front image is required.";
        if (!documents.backUrl)
          errs.backUrl = "National ID back image is required.";
      } else {
        if (!documents.civilRegistryExtract)
          errs.civilRegistryExtract =
            "Civil Registry Extract document is required.";
      }
      if (!documents.passportPhoto)
        errs.passportPhoto = "Passport photo is required.";
      if (applicationType === "RENEWAL" && !documents.oldPassport)
        errs.oldPassport =
          "Old passport scan is required for renewal applications.";
    }
    if (step === 4) {
      if (!mukhtarForm.address.trim()) errs.address = "Address is required.";
      if (!mukhtarForm.district.trim())
        errs.district = "District / Qada is required.";
      if (!mukhtarForm.mukhtarName.trim())
        errs.mukhtarName = "Mukhtar's name is required.";
    }
    if (step === 5 && applicationType === "NEW" && !biometricCaptured) {
      errs.biometric = "Biometric capture must be completed before proceeding.";
    }

    if (Object.keys(errs).length > 0) {
      setStepErrors(errs);
      return;
    }

    setStepErrors({});

    // Step 4 → Step 5 transition for NEW applications: create the application
    // now so its real UUID can be used as the storage path for face frames.
    // If the user navigated Back and is re-advancing, reuse the existing id.
    if (
      step === 4 &&
      applicationType === "NEW" &&
      createdApplicationId === null
    ) {
      setIsAdvancing(true);
      setSubmitError("");
      try {
        const created = await applicationService.createApplication(
          currentUser.user.id,
          {
            applicationId: "app_" + Date.now(),
            userId: currentUser.user.id,
            applicationType: "NEW",
            currentStatus: "PENDING_REVIEW",
            submissionDate: new Date().toISOString(),
            trackingNumber: applicationService.generateTrackingNumber(),
            passportValidity: passportValidity!,
            feeAmount: FEE_MAP[passportValidity!],
            paymentStatus: "UNPAID",
            identityDocumentType,
            documents: buildDocumentSnapshot(),
            mukhtarFormData: mukhtarForm,
            biometricCaptured: false,
            renewingPassportId: null,
          },
        );
        setCreatedApplicationId(created.applicationId);
      } catch (err) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "Failed to create application. Please try again.",
        );
        return;
      } finally {
        setIsAdvancing(false);
      }
    }

    // Renewal skips step 5 (biometrics): jump from 4 to 6
    if (applicationType === "RENEWAL" && step === 4) {
      setStep(6);
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setStepErrors({});
    // Reset the fee acknowledgement so it must be re-confirmed if the user
    // returns to Step 6 — they may change values that affect the fee.
    setFeeAcknowledged(false);
    // When the type was pre-selected via URL param, Step 1 is unreachable —
    // Back from Step 2 returns to the checklist instead.
    if (typeLocked && step === 2) {
      navigate("/application/checklist");
      return;
    }
    // Renewal skips step 5 when going back from step 6
    if (applicationType === "RENEWAL" && step === 6) {
      setStep(4);
    } else {
      setStep((s) => s - 1);
    }
  };

  // Type validation now lives inside EnhancedFileUploadField; parent only stores the accepted file.
  const handleFileChange = (field: keyof DocumentFiles, file: File | null) => {
    setDocuments((prev) => ({ ...prev, [field]: file }));
    if (file) setStepErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const clearFile = (field: keyof DocumentFiles) => {
    setDocuments((prev) => ({ ...prev, [field]: null }));
  };

  const handleIdentityDocumentTypeChange = (type: IdentityDocumentType) => {
    setIdentityDocumentType(type);
    setDocuments((prev) =>
      type === "NATIONAL_ID"
        ? { ...prev, identityDocument: null, civilRegistryExtract: null }
        : {
            ...prev,
            identityDocument: null,
            frontUrl: null,
            backUrl: null,
          },
    );
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next.identityDocument;
      delete next.frontUrl;
      delete next.backUrl;
      delete next.civilRegistryExtract;
      return next;
    });
  };

  const buildDocumentSnapshot = (): PassportApplication["documents"] => ({
    identityDocument: null,
    frontUrl: documents.frontUrl?.name ?? null,
    backUrl: documents.backUrl?.name ?? null,
    civilRegistryExtract: documents.civilRegistryExtract?.name ?? null,
    passportPhoto: documents.passportPhoto?.name ?? null,
    oldPassport: documents.oldPassport?.name ?? null,
  });

  const handleMukhtarChange = (field: keyof MukhtarForm, value: string) => {
    setMukhtarForm((prev) => ({ ...prev, [field]: value }));
    if (value.trim()) setStepErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      let finalApplicationId = createdApplicationId;

      // NEW applications already created at Step 4 → Step 5 transition.
      // RENEWAL skips Step 5 entirely, so we create it here at submit time.
      if (applicationType === "RENEWAL") {
        // Resolve fromExpiry to a passportId so the expiry banner can be
        // suppressed while this renewal is active.
        let renewingPassportId: string | null = null;
        const fromExpiry = searchParams.get("fromExpiry");
        if (fromExpiry) {
          const passports = await passportService.getPassportsByUser(
            currentUser.user.id,
          );
          const match = passports.find(
            (p) => p.sourceApplicationId === fromExpiry,
          );
          renewingPassportId = match?.passportId ?? null;
        }

        const created = await applicationService.createApplication(
          currentUser.user.id,
          {
            applicationId: "app_" + Date.now(),
            userId: currentUser.user.id,
            applicationType: "RENEWAL",
            currentStatus: "PENDING_REVIEW",
            submissionDate: new Date().toISOString(),
            trackingNumber: applicationService.generateTrackingNumber(),
            passportValidity: passportValidity!,
            feeAmount: FEE_MAP[passportValidity!],
            paymentStatus: "UNPAID",
            identityDocumentType,
            documents: buildDocumentSnapshot(),
            mukhtarFormData: mukhtarForm,
            biometricCaptured,
            renewingPassportId,
          },
        );
        finalApplicationId = created.applicationId;
      }

      if (!finalApplicationId) {
        throw new Error("Application ID missing — please restart the flow.");
      }

      await documentService.uploadDocuments(finalApplicationId, documents);
      navigate(`/application/pay/${finalApplicationId}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Application submission failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
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

        <ProgressBar
          currentStep={applicationType === "RENEWAL" && step === 6 ? 5 : step}
          labels={
            applicationType === "RENEWAL"
              ? STEP_LABELS_RENEWAL
              : STEP_LABELS_NEW
          }
        />

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
              identityDocumentType={identityDocumentType}
              onIdentityDocumentTypeChange={handleIdentityDocumentTypeChange}
              documents={documents}
              stepErrors={stepErrors}
              onFileChange={handleFileChange}
              onClearFile={clearFile}
            />
          )}
          {step === 4 && (
            <Step4MukhtarDetails
              mukhtarForm={mukhtarForm}
              onMukhtarChange={handleMukhtarChange}
              errors={stepErrors}
            />
          )}
          {step === 5 && applicationType === "NEW" && createdApplicationId && (
            <Step5BiometricCapture
              applicationId={createdApplicationId}
              biometricCaptured={biometricCaptured}
              onBiometricCapture={() => {
                setBiometricCaptured(true);
                setStepErrors((p) => ({ ...p, biometric: "" }));
              }}
              error={stepErrors.biometric}
            />
          )}
          {step === 6 && (
            <Step6Review
              applicationType={applicationType!}
              passportValidity={passportValidity!}
              feeAmount={FEE_MAP[passportValidity!]}
              identityDocumentType={identityDocumentType}
              documents={documents}
              mukhtarForm={mukhtarForm}
              biometricCaptured={biometricCaptured}
              feeAcknowledged={feeAcknowledged}
              onToggleFeeAcknowledged={() => setFeeAcknowledged((v) => !v)}
            />
          )}

          {/* Navigation */}
          {submitError && (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

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
            {step < 6 ? (
              <button
                onClick={goNext}
                disabled={isAdvancing}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isAdvancing && (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isAdvancing ? "Creating..." : "Next"}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !feeAcknowledged}
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
            ${
              selected === type
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
            ${
              validity === years
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
            <div className="font-medium text-gray-800">
              {years}-Year Passport
            </div>
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
  identityDocumentType,
  onIdentityDocumentTypeChange,
  documents,
  stepErrors,
  onFileChange,
  onClearFile,
}: {
  applicationType: ApplicationType;
  identityDocumentType: IdentityDocumentType;
  onIdentityDocumentTypeChange: (type: IdentityDocumentType) => void;
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Identity Document Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ["NATIONAL_ID", "National ID"],
            ["CIVIL_REGISTRY_EXTRACT", "Civil Registry Extract"],
          ] as const).map(([value, label]) => (
            <label
              key={value}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                identityDocumentType === value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <input
                type="radio"
                name="identityDocumentType"
                value={value}
                checked={identityDocumentType === value}
                onChange={() => onIdentityDocumentTypeChange(value)}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-800">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {identityDocumentType === "NATIONAL_ID" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EnhancedFileUploadField
            id="frontUrl"
            label="National ID Front"
            accept=".jpg,.jpeg,.png"
            acceptLabel="JPG, PNG"
            file={documents.frontUrl}
            stepError={stepErrors.frontUrl}
            required
            validator={isValidPhoto}
            typeErrorMsg="Only JPG and PNG image files are accepted."
            onChange={(f) => onFileChange("frontUrl", f)}
            onClear={() => onClearFile("frontUrl")}
          />
          <EnhancedFileUploadField
            id="backUrl"
            label="National ID Back"
            accept=".jpg,.jpeg,.png"
            acceptLabel="JPG, PNG"
            file={documents.backUrl}
            stepError={stepErrors.backUrl}
            required
            validator={isValidPhoto}
            typeErrorMsg="Only JPG and PNG image files are accepted."
            onChange={(f) => onFileChange("backUrl", f)}
            onClear={() => onClearFile("backUrl")}
          />
        </div>
      ) : (
        <EnhancedFileUploadField
          id="civilRegistryExtract"
          label="Civil Registry Extract"
          accept=".pdf,.jpg,.jpeg,.png"
          acceptLabel="PDF, JPG, PNG"
          file={documents.civilRegistryExtract}
          stepError={stepErrors.civilRegistryExtract}
          required
          validator={isValidDoc}
          typeErrorMsg="Only PDF, JPG, and PNG files are accepted."
          onChange={(f) => onFileChange("civilRegistryExtract", f)}
          onClear={() => onClearFile("civilRegistryExtract")}
        />
      )}

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

// ─── Step 4: Mukhtar Details ─────────────────────────────────────────────────

const Step4MukhtarDetails = ({
  mukhtarForm,
  onMukhtarChange,
  errors,
}: {
  mukhtarForm: MukhtarForm;
  onMukhtarChange: (field: keyof MukhtarForm, value: string) => void;
  errors: Record<string, string>;
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-1">
      Mukhtar Details
    </h2>
    <p className="text-gray-500 text-sm mb-6">
      Provide your mukhtar's details.
    </p>

    <div className="space-y-4">
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
  </div>
);

// ─── Step 5: Biometric Capture (NEW applications only) ────────────────────────

const Step5BiometricCapture = ({
  applicationId,
  biometricCaptured,
  onBiometricCapture,
  error,
}: {
  applicationId: string;
  biometricCaptured: boolean;
  onBiometricCapture: () => void;
  error?: string;
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-1">
      Face Capture
    </h2>
    <p className="text-gray-500 text-sm mb-6">
      A live face capture is required for all new passport applications.
    </p>

    {biometricCaptured ? (
      <div className="flex items-center gap-2 text-green-700 font-medium p-4 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-2xl">✓</span> Face capture complete
      </div>
    ) : (
      <BiometricCaptureWidget
        applicationId={applicationId}
        onCaptureComplete={(result) => {
          if (result.faceCaptured && result.fingerprintsCaptured) {
            onBiometricCapture();
          }
        }}
      />
    )}

    {import.meta.env.DEV && !biometricCaptured && (
      <button
        onClick={onBiometricCapture}
        className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors text-sm font-medium"
      >
        Skip (Dev Only)
      </button>
    )}

    <p className="text-gray-500 text-xs mt-4">
      Face capture data is encrypted and stored in compliance with ISO/IEC
      19794-5.
    </p>

    {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
  </div>
);

// ─── Step 6: Review & Submit ──────────────────────────────────────────────────

const Step6Review = ({
  applicationType,
  passportValidity,
  feeAmount,
  identityDocumentType,
  documents,
  mukhtarForm,
  biometricCaptured,
  feeAcknowledged,
  onToggleFeeAcknowledged,
}: {
  applicationType: ApplicationType;
  passportValidity: ValidityYears;
  feeAmount: number;
  identityDocumentType: IdentityDocumentType;
  documents: DocumentFiles;
  mukhtarForm: MukhtarForm;
  biometricCaptured: boolean;
  feeAcknowledged: boolean;
  onToggleFeeAcknowledged: () => void;
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
          value={
            applicationType === "NEW" ? "New Passport" : "Passport Renewal"
          }
        />
      </ReviewSection>

      <ReviewSection title="Passport Details">
        <ReviewRow label="Validity" value={`${passportValidity} Years`} />
        <ReviewRow label="Fee" value={`${feeAmount.toLocaleString()} LBP`} />
      </ReviewSection>

      <ReviewSection title="Documents">
        <ReviewRow
          label="Identity Document Type"
          value={
            identityDocumentType === "NATIONAL_ID"
              ? "National ID"
              : "Civil Registry Extract"
          }
        />
        {identityDocumentType === "NATIONAL_ID" ? (
          <>
            <ReviewRow
              label="National ID Front"
              value={documents.frontUrl?.name ?? "—"}
            />
            <ReviewRow
              label="National ID Back"
              value={documents.backUrl?.name ?? "—"}
            />
          </>
        ) : (
          <ReviewRow
            label="Civil Registry Extract"
            value={documents.civilRegistryExtract?.name ?? "—"}
          />
        )}
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
            label="Face Capture"
            value={biometricCaptured ? "Completed" : "Not captured"}
          />
        </ReviewSection>
      )}
    </div>

    <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
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
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
      <div>
        <p className="text-blue-800 text-sm font-medium">
          Payment required after submission
        </p>
        <p className="text-blue-700 text-sm mt-0.5">
          You will be redirected to complete payment of{" "}
          <span className="font-semibold">
            {feeAmount.toLocaleString()} LBP
          </span>{" "}
          via CashPlus after submitting.
        </p>
      </div>
    </div>

    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-yellow-800 text-sm">
        By submitting this application, you confirm that all provided
        information is accurate and complete. Providing false information may
        result in rejection.
      </p>
    </div>

    {/* FR-09 — explicit fee acknowledgement, gates Submit Application */}
    <label
      className={`mt-4 flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
        feeAcknowledged
          ? "border-green-300 bg-green-50"
          : "border-gray-300 bg-white hover:bg-gray-50"
      }`}
    >
      <input
        type="checkbox"
        checked={feeAcknowledged}
        onChange={onToggleFeeAcknowledged}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
      />
      <span
        className={`text-sm ${
          feeAcknowledged ? "text-green-800" : "text-gray-700"
        }`}
      >
        I acknowledge that I am required to pay{" "}
        <span className="font-semibold">{feeAmount.toLocaleString()} LBP</span>{" "}
        to complete this application. I understand that failure to complete
        payment within 15 minutes will result in the application being
        cancelled.
      </span>
    </label>
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
