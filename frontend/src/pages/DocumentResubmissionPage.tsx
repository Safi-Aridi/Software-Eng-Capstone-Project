import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  type PassportApplication,
} from "../services/applicationService";
import EnhancedFileUploadField from "../components/upload/EnhancedFileUploadField";

const ALLOWED_DOC_EXTS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_PHOTO_EXTS = ["jpg", "jpeg", "png"];

const getExt = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isValidDoc = (f: File) => ALLOWED_DOC_EXTS.includes(getExt(f));
const isValidPhoto = (f: File) => ALLOWED_PHOTO_EXTS.includes(getExt(f));

interface DocumentFiles {
  identityDocument: File | null;
  passportPhoto: File | null;
  oldPassport: File | null;
}

const DocumentResubmissionPage = () => {
  const navigate = useNavigate();
  const { applicationId } = useParams<{ applicationId: string }>();
  const currentUser = authService.getCurrentUser();

  const [app, setApp] = useState<PassportApplication | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [documents, setDocuments] = useState<DocumentFiles>({
    identityDocument: null,
    passportPhoto: null,
    oldPassport: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleResubmit = async () => {
    const errs: Record<string, string> = {};
    if (!documents.identityDocument)
      errs.identityDocument = "Identity document is required.";
    if (!documents.passportPhoto)
      errs.passportPhoto = "Passport photo is required.";
    if (app.applicationType === "RENEWAL" && !documents.oldPassport)
      errs.oldPassport = "Old passport scan is required for renewal applications.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setIsSubmitting(true);

    // TODO: Replace with POST /api/applications/:id/resubmit when backend is ready
    await applicationService.updateApplicationDocuments(
      currentUser.user.id,
      app.applicationId,
      {
        identityDocument: documents.identityDocument?.name ?? null,
        passportPhoto: documents.passportPhoto?.name ?? null,
        oldPassport: documents.oldPassport?.name ?? null,
      },
    );

    setIsSubmitting(false);
    navigate(`/application/status/${app.applicationId}`, {
      state: {
        successMessage:
          "Documents resubmitted successfully. Your application is under review again.",
      },
    });
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

        {/* Notice */}
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-orange-800 text-sm">
            Please upload clear, valid documents. Ensure all details are
            legible. Your application will be re-reviewed after submission.
          </p>
        </div>

        {/* Upload fields */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 mb-1">
            Upload Documents
          </h2>

          <EnhancedFileUploadField
            id="resubmit-identityDocument"
            label="Identity Document"
            accept=".pdf,.jpg,.jpeg,.png"
            acceptLabel="PDF, JPG, PNG"
            file={documents.identityDocument}
            stepError={fieldErrors.identityDocument}
            required
            validator={isValidDoc}
            typeErrorMsg="Only PDF, JPG, and PNG files are accepted."
            onChange={(f) => handleFileChange("identityDocument", f)}
            onClear={() => clearFile("identityDocument")}
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

          {app.applicationType === "RENEWAL" && (
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
          )}

          <div className="pt-2 border-t border-gray-100">
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
