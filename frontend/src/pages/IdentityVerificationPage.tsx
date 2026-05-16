import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import EnhancedFileUploadField from "../components/upload/EnhancedFileUploadField";

type IdentityDocumentType = "NATIONAL_ID" | "CIVIL_REGISTRY_EXTRACT";

interface IdentityData {
  fullName: string;
  registryNumber: string;
  dob: string;
  documentType: string;
  frontDocumentName?: string | null;
  backDocumentName?: string | null;
  civilRegistryExtractName?: string | null;
}

interface IdentityDocuments {
  frontUrl: File | null;
  backUrl: File | null;
  civilRegistryExtract: File | null;
}

const ALLOWED_DOC_EXTS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_PHOTO_EXTS = ["jpg", "jpeg", "png"];

const getExt = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isValidDoc = (file: File) => ALLOWED_DOC_EXTS.includes(getExt(file));
const isValidPhoto = (file: File) => ALLOWED_PHOTO_EXTS.includes(getExt(file));

const IdentityVerificationPage = () => {
  const navigate = useNavigate();

  const [identityDocumentType, setIdentityDocumentType] =
    useState<IdentityDocumentType>("NATIONAL_ID");

  const [documents, setDocuments] = useState<IdentityDocuments>({
    frontUrl: null,
    backUrl: null,
    civilRegistryExtract: null,
  });

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<IdentityData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = authService.getCurrentUser();

  if (!currentUser || currentUser.role !== "citizen") {
    navigate("/");
    return null;
  }

  const handleIdentityDocumentTypeChange = (type: IdentityDocumentType) => {
    setIdentityDocumentType(type);
    setExtractedData(null);
    setStepErrors({});

    setDocuments((prev) =>
      type === "NATIONAL_ID"
        ? {
            ...prev,
            civilRegistryExtract: null,
          }
        : {
            ...prev,
            frontUrl: null,
            backUrl: null,
          },
    );
  };

  const handleFileChange = (
    field: keyof IdentityDocuments,
    file: File | null,
  ) => {
    setDocuments((prev) => ({ ...prev, [field]: file }));
    setExtractedData(null);

    if (file) {
      setStepErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const clearFile = (field: keyof IdentityDocuments) => {
    setDocuments((prev) => ({ ...prev, [field]: null }));
    setExtractedData(null);
  };

  const validateDocuments = () => {
    const errors: Record<string, string> = {};

    if (identityDocumentType === "NATIONAL_ID") {
      if (!documents.frontUrl) {
        errors.frontUrl = "National ID front image is required.";
      }

      if (!documents.backUrl) {
        errors.backUrl = "National ID back image is required.";
      }
    } else {
      if (!documents.civilRegistryExtract) {
        errors.civilRegistryExtract =
          "Civil Registry Extract document is required.";
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canExtract =
    identityDocumentType === "NATIONAL_ID"
      ? !!documents.frontUrl && !!documents.backUrl
      : !!documents.civilRegistryExtract;

  const handleExtractIdentity = async () => {
    if (!validateDocuments()) return;

    setIsExtracting(true);
    setStepErrors({});

    try {
      // Convert files to base64 and send directly to ML
      const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const ML_URL = "http://64.227.163.65:8000/extract-id-data";
      let mlBody: any;

      if (identityDocumentType === "NATIONAL_ID") {
        const frontB64 = await fileToBase64(documents.frontUrl!);
        const backB64 = await fileToBase64(documents.backUrl!);
        mlBody = { document_type: "id_card", front_base64: frontB64, back_base64: backB64 };
      } else {
        const extractB64 = await fileToBase64(documents.civilRegistryExtract!);
        mlBody = { document_type: "civil_registry", document_base64: extractB64 };
      }

      const mlResp = await fetch(ML_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mlBody),
      });

      const mlRawText = await mlResp.text();
      const mlData = JSON.parse(mlRawText);

      if (!mlResp.ok || mlData.status === "error") {
        const errMsg = mlData.detail || mlData.message || "Extraction failed. Please try again with clearer images.";
        const cleanErr = typeof errMsg === "object" ? JSON.stringify(errMsg) : String(errMsg);
        setStepErrors({ extract: cleanErr.replace("ID_ERROR: ", "") });
        return;
      }

      const data = mlData.data || mlData;

      // Build full name from extracted parts
      const firstName = data.first_name?.en || "";
      const lastName = data.last_name?.en || "";
      const extractedFullName = `${firstName} ${lastName}`.trim();

      // Compare with signup name
      const signupName = (currentUser.user.fullName || "").trim().toLowerCase();
      const mlName = extractedFullName.toLowerCase();
      const nameMatch = signupName === mlName || signupName.includes(mlName) || mlName.includes(signupName);

      const extractedResult: IdentityData = {
        fullName: extractedFullName || currentUser.user.fullName || "",
        registryNumber: data.registry_number?.latin || data.id_number?.latin || "",
        dob: data.dob?.latin || "",
        documentType: identityDocumentType === "NATIONAL_ID" ? "National ID" : "Civil Registry Extract",
        frontDocumentName: documents.frontUrl?.name ?? null,
        backDocumentName: documents.backUrl?.name ?? null,
        civilRegistryExtractName: documents.civilRegistryExtract?.name ?? null,
      };

      setExtractedData(extractedResult);

      if (!nameMatch) {
        setStepErrors({
          extract: `Name mismatch: Your signup name "${currentUser.user.fullName}" does not match the ID name "${extractedFullName}". You will be logged out for security.`,
        });
        setExtractedData(null);
        setTimeout(() => {
          authService.logout();
          navigate("/login");
        }, 3000);
        return;
      }
    } catch (err: any) {
      setStepErrors({ extract: err.message || "Failed to extract identity. Please try again." });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!extractedData) {
      alert("Please extract identity details first");
      return;
    }

    setIsSubmitting(true);

    authService.saveIdentityData(extractedData);
    authService.updateAccountStatus("PENDING_IDENTITY_VERIFICATION");

    setTimeout(() => {
      setIsSubmitting(false);
      navigate("/citizen/dashboard");
    }, 1000);
  };

  const handleInputChange = (field: keyof IdentityData, value: string) => {
    if (!extractedData) return;

    setExtractedData({
      ...extractedData,
      [field]: value,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Identity Verification
            </h1>
            <p className="text-gray-600">
              Confirm your identity before using passport services
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Step 1: Select Identity Document Type
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["NATIONAL_ID", "National ID"],
                ["CIVIL_REGISTRY_EXTRACT", "Civil Registry Extract"],
              ].map(([value, label]) => (
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
                    onChange={() =>
                      handleIdentityDocumentTypeChange(
                        value as IdentityDocumentType,
                      )
                    }
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Step 2: Upload Document
            </h2>

            <div className="space-y-5">
              {identityDocumentType === "NATIONAL_ID" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EnhancedFileUploadField
                    id="identity-frontUrl"
                    label="National ID Front"
                    accept=".jpg,.jpeg,.png"
                    acceptLabel="JPG, PNG"
                    file={documents.frontUrl}
                    stepError={stepErrors.frontUrl}
                    required
                    validator={isValidPhoto}
                    typeErrorMsg="Only JPG and PNG image files are accepted."
                    onChange={(file) => handleFileChange("frontUrl", file)}
                    onClear={() => clearFile("frontUrl")}
                  />

                  <EnhancedFileUploadField
                    id="identity-backUrl"
                    label="National ID Back"
                    accept=".jpg,.jpeg,.png"
                    acceptLabel="JPG, PNG"
                    file={documents.backUrl}
                    stepError={stepErrors.backUrl}
                    required
                    validator={isValidPhoto}
                    typeErrorMsg="Only JPG and PNG image files are accepted."
                    onChange={(file) => handleFileChange("backUrl", file)}
                    onClear={() => clearFile("backUrl")}
                  />
                </div>
              ) : (
                <EnhancedFileUploadField
                  id="identity-civilRegistryExtract"
                  label="Civil Registry Extract"
                  accept=".pdf,.jpg,.jpeg,.png"
                  acceptLabel="PDF, JPG, PNG"
                  file={documents.civilRegistryExtract}
                  stepError={stepErrors.civilRegistryExtract}
                  required
                  validator={isValidDoc}
                  typeErrorMsg="Only PDF, JPG, and PNG files are accepted."
                  onChange={(file) =>
                    handleFileChange("civilRegistryExtract", file)
                  }
                  onClear={() => clearFile("civilRegistryExtract")}
                />
              )}
            </div>

            <p className="text-sm text-gray-500 mt-3">
              After you upload your document, we will extract your identity
              details for review.
            </p>
          </div>

           <div className="mb-8">
            {stepErrors.extract && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {stepErrors.extract}
              </div>
            )}
            <button
              onClick={handleExtractIdentity}
              disabled={!canExtract || isExtracting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isExtracting
                ? "Extracting identity details..."
                : "Extract identity details"}
            </button>
          </div>

          {extractedData && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Review extracted identity details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={extractedData.fullName}
                    onChange={(e) =>
                      handleInputChange("fullName", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    National Registry Number
                  </label>
                  <input
                    type="text"
                    value={extractedData.registryNumber}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Registry number is read-only for security
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={extractedData.dob}
                    onChange={(e) => handleInputChange("dob", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type
                  </label>
                  <input
                    type="text"
                    value={extractedData.documentType}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                  />
                </div>
              </div>
            </div>
          )}

          {extractedData && (
            <button
              onClick={handleSubmitVerification}
              disabled={isSubmitting}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting
                ? "Submitting for verification..."
                : "Submit for verification"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdentityVerificationPage;