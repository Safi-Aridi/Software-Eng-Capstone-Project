import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  inferIdentityDocumentType,
  type IdentityDocumentType,
  type PassportApplication,
} from "../services/applicationService";
import { documentService } from "../services/documentService";
import EnhancedFileUploadField from "../components/upload/EnhancedFileUploadField";

const ALLOWED_DOC_EXTS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_PHOTO_EXTS = ["jpg", "jpeg", "png"];

const getExt = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isValidDoc = (f: File) => ALLOWED_DOC_EXTS.includes(getExt(f));
const isValidPhoto = (f: File) => ALLOWED_PHOTO_EXTS.includes(getExt(f));

interface DocumentFiles {
  identityDocument: File | null;
  frontUrl: File | null;
  backUrl: File | null;
  civilRegistryExtract: File | null;
  passportPhoto: File | null;
  oldPassport: File | null;
}

type DocumentField = keyof DocumentFiles;

const ACCEPTANCE_CRITERIA: Record<DocumentField, string[]> = {
  identityDocument: [
    "Lebanese National ID Card or Civil Registry Extract",
    "Issued less than 3 months ago",
    "QR code on the document is scannable",
  ],
  frontUrl: [
    "Front side of the Lebanese National ID Card",
    "Image is clear and uncropped",
    "All printed text is readable",
  ],
  backUrl: [
    "Back side of the Lebanese National ID Card",
    "Image is clear and uncropped",
    "All printed text is readable",
  ],
  civilRegistryExtract: [
    "Civil Registry Extract issued less than 3 months ago",
    "QR code on the document is scannable",
    "All printed text is readable",
  ],
  passportPhoto: [
    "3.5 × 4.5 cm",
    "White background",
    "Face clearly visible with no obstructions",
  ],
  oldPassport: [
    "MRZ at the bottom is fully legible",
    "Passport not reported lost or stolen",
  ],
};

const FieldGuidance = ({
  field,
  reason,
}: {
  field: DocumentField;
  reason?: string;
}) => (
  <div className="mb-2 space-y-2">
    {reason ? (
      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
        <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1">
          Reviewer feedback
        </p>
        <p className="text-sm text-red-700">{reason}</p>
      </div>
    ) : (
      <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
        <svg
          className="w-4 h-4 text-green-600 mt-0.5 shrink-0"
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
        <p className="text-sm text-green-800">
          <span className="font-semibold">Previously accepted.</span> You don't
          need to re-upload this, but you may if you'd like.
        </p>
      </div>
    )}
    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
        Acceptance criteria
      </p>
      <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-4">
        {ACCEPTANCE_CRITERIA[field].map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  </div>
);

const getIdentityResubmissionFields = (
  app: PassportApplication,
): DocumentField[] => {
  const type: IdentityDocumentType | null =
    app.identityDocumentType ?? inferIdentityDocumentType(app.documents);

  if (type === "NATIONAL_ID") return ["frontUrl", "backUrl"];
  if (type === "CIVIL_REGISTRY_EXTRACT") return ["civilRegistryExtract"];
  return ["identityDocument"];
};

const IDENTITY_FIELD_LABELS: Record<DocumentField, string> = {
  identityDocument: "Identity Document",
  frontUrl: "National ID Front",
  backUrl: "National ID Back",
  civilRegistryExtract: "Civil Registry Extract",
  passportPhoto: "Passport Photo",
  oldPassport: "Old Passport Scan",
};

const DocumentResubmissionPage = () => {
  const navigate = useNavigate();
  const { applicationId } = useParams<{ applicationId: string }>();
  const currentUser = authService.getCurrentUser();

  const [app, setApp] = useState<PassportApplication | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [documents, setDocuments] = useState<DocumentFiles>({
    identityDocument: null,
    frontUrl: null,
    backUrl: null,
    civilRegistryExtract: null,
    passportPhoto: null,
    oldPassport: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  if (app.currentStatus !== "RESUBMISSION_REQUIRED") {
    navigate(`/application/status/${app.applicationId}`);
    return null;
  }

  const handleFileChange = (field: keyof DocumentFiles, file: File | null) => {
    setDocuments((prev) => ({ ...prev, [field]: file }));
    if (file) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const clearFile = (field: keyof DocumentFiles) => {
    setDocuments((prev) => ({ ...prev, [field]: null }));
  };

  const identityFields = getIdentityResubmissionFields(app);

  const handleResubmit = async () => {
  const errs: Record<string, string> = {};
  
  // VALIDATION CHECK: Make sure these aren't blocking you!
  identityFields.forEach((field) => {
    if (!documents[field]) {
      errs[field] = `${IDENTITY_FIELD_LABELS[field]} is required.`;
    }
  });
  
  if (!documents.passportPhoto) errs.passportPhoto = "Passport photo is required.";

  if (Object.keys(errs).length > 0) {
    setFieldErrors(errs);
    return; // This is why the button "doesn't work" if fields are empty
  }

  setIsSubmitting(true);
  setSubmitError(""); // Clear old errors

  try {
    const uploadedDocuments = await documentService.uploadDocuments(
      app.applicationId,
      documents,
    );

    await applicationService.updateApplicationDocuments(
      currentUser.user.id,
      app.applicationId,
      uploadedDocuments,
    );

    navigate(`/application/status/${app.applicationId}`);
  } catch (err: any) {
    // --- THE CLEAN MSG LOGIC ---
    let rawMsg = err?.message || "Verification failed";
    
    // If it's that giant JSON string, shorten it
    const cleanMsg = rawMsg.length > 100 
      ? "AI Verification Error: The ID data format was incompatible with the face matcher."
      : rawMsg;
      
    setSubmitError(cleanMsg);
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(`/application/status/${app.applicationId}`)}
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
          Back to Application Status
        </button>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Resubmit Documents
        </h1>
        <p className="text-gray-600 mb-6">
          Upload new documents for your application to continue processing.
        </p>

        {/* Application info */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Application</p>
            <p className="font-semibold text-gray-800">
              {app.applicationType === "NEW"
                ? "New Passport"
                : "Passport Renewal"}
            </p>
            <p className="font-mono text-xs text-gray-500 mt-0.5">
              {app.trackingNumber}
            </p>
          </div>
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
            Resubmission Required
          </span>
        </div>

        {/* Red alert banner */}
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-600 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <p className="text-red-800 text-sm">
            <span className="font-semibold">
              Your documents require corrections.
            </span>{" "}
            Please review the issues below and resubmit.
          </p>
        </div>

        {/* Upload fields */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">
            Upload Documents
          </h2>

          {identityFields.map((field) => {
            const imageOnly = field === "frontUrl" || field === "backUrl";
            return (
              <div key={field}>
                <FieldGuidance
                  field={field}
                  reason={app.resubmissionReasons?.[field]}
                />
                <EnhancedFileUploadField
                  id={`resubmit-${field}`}
                  label={IDENTITY_FIELD_LABELS[field]}
                  accept={imageOnly ? ".jpg,.jpeg,.png" : ".pdf,.jpg,.jpeg,.png"}
                  acceptLabel={imageOnly ? "JPG, PNG" : "PDF, JPG, PNG"}
                  file={documents[field]}
                  stepError={fieldErrors[field]}
                  required
                  validator={imageOnly ? isValidPhoto : isValidDoc}
                  typeErrorMsg={
                    imageOnly
                      ? "Only JPG and PNG image files are accepted."
                      : "Only PDF, JPG, and PNG files are accepted."
                  }
                  onChange={(f) => handleFileChange(field, f)}
                  onClear={() => clearFile(field)}
                />
              </div>
            );
          })}

          <div>
            <FieldGuidance
              field="passportPhoto"
              reason={app.resubmissionReasons?.passportPhoto}
            />
            <EnhancedFileUploadField
              id="resubmit-passportPhoto"
              label="Passport Photo"
              accept=".jpg,.jpeg,.png"
              acceptLabel="JPG, PNG"
              file={documents.passportPhoto}
              stepError={fieldErrors.passportPhoto}
              required
              validator={isValidPhoto}
              typeErrorMsg="Only JPG and PNG files are accepted for passport photos."
              onChange={(f) => handleFileChange("passportPhoto", f)}
              onClear={() => clearFile("passportPhoto")}
            />
          </div>

          {app.applicationType === "RENEWAL" && (
            <div>
              <FieldGuidance
                field="oldPassport"
                reason={app.resubmissionReasons?.oldPassport}
              />
              <EnhancedFileUploadField
                id="resubmit-oldPassport"
                label="Old Passport Scan"
                accept=".pdf,.jpg,.jpeg,.png"
                acceptLabel="PDF, JPG, PNG"
                file={documents.oldPassport}
                stepError={fieldErrors.oldPassport}
                required
                validator={isValidDoc}
                typeErrorMsg="Only PDF, JPG, and PNG files are accepted."
                onChange={(f) => handleFileChange("oldPassport", f)}
                onClear={() => clearFile("oldPassport")}
              />
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            {submitError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button
              onClick={handleResubmit}
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? "Submitting..." : "Resubmit Documents"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentResubmissionPage;