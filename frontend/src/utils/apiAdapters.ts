import type { PassportApplication } from "../services/applicationService";

// ─── Snake → Camel ────────────────────────────────────────────────────────────

export const snakeToCamel = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        snakeToCamel(value),
      ]),
    );
  }
  return obj;
};

// ─── Application status ───────────────────────────────────────────────────────

const STATUS_B2F: Record<string, string> = {
  "Pending": "PENDING_REVIEW",
  "Fingerprint Required": "FINGERPRINT_REQUIRED",
  // Legacy: any rows still in 'Verified' (pre-migration 007) map to the new
  // FINGERPRINT_REQUIRED bucket so they keep displaying correctly.
  "Verified": "VERIFIED",
  "Mukhtar Signed": "MUKHTAR_SIGNED",
  "Processed for Issuance": "PROCESSED",
  "Issued": "ISSUED",
  "Resubmission Required": "RESUBMISSION_REQUIRED",
  "Delivered": "DELIVERED",
  "Delivery Failed - Branch Collection Required": "DELIVERED",
};

const STATUS_F2B: Record<string, string> = {
  "PENDING_REVIEW": "Pending",
  "FINGERPRINT_REQUIRED": "Fingerprint Required",
  "VERIFIED": "Verified",
  "MUKHTAR_SIGNED": "Mukhtar Signed",
  "PROCESSED": "Processed for Issuance",
  "ISSUED": "Issued",
  "RESUBMISSION_REQUIRED": "Resubmission Required",
  "DELIVERED": "Delivered",
};

export const backendStatusToFrontend = (s: string): string =>
  STATUS_B2F[s] ?? s;

export const frontendStatusToBackend = (s: string): string =>
  STATUS_F2B[s] ?? s;

// ─── Payment status ───────────────────────────────────────────────────────────

const PAYMENT_B2F: Record<string, string> = {
  "Pending": "UNPAID",
  "Paid": "Paid",
  "Failed": "Failed",
};

const PAYMENT_F2B: Record<string, string> = {
  "UNPAID": "Pending",
  "Paid": "Paid",
  "Failed": "Failed",
};

export const backendPaymentStatusToFrontend = (s: string): string =>
  PAYMENT_B2F[s] ?? s;

export const frontendPaymentStatusToBackend = (s: string): string =>
  PAYMENT_F2B[s] ?? s;

// ─── Application type ─────────────────────────────────────────────────────────

export const backendAppTypeToFrontend = (s: string): "NEW" | "RENEWAL" =>
  s === "renewal" ? "RENEWAL" : "NEW";

export const frontendAppTypeToBackend = (s: string): string =>
  s === "RENEWAL" ? "renewal" : "new_passport";

const parseResubmissionReasons = (
  value: unknown,
  currentStatus: string,
): PassportApplication["resubmissionReasons"] => {
  if (currentStatus !== "RESUBMISSION_REQUIRED") return undefined;

  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;

  if (!parsed || typeof parsed !== "object") return undefined;
  const input = parsed as Record<string, unknown>;

  return {
    identityDocument:
      typeof input.identityDocument === "string"
        ? input.identityDocument
        : undefined,
    frontUrl: typeof input.frontUrl === "string" ? input.frontUrl : undefined,
    backUrl: typeof input.backUrl === "string" ? input.backUrl : undefined,
    civilRegistryExtract:
      typeof input.civilRegistryExtract === "string"
        ? input.civilRegistryExtract
        : undefined,
    passportPhoto:
      typeof input.passportPhoto === "string" ? input.passportPhoto : undefined,
    oldPassport:
      typeof input.oldPassport === "string" ? input.oldPassport : undefined,
  };
};

// ─── Full application mapper ──────────────────────────────────────────────────

const parseMukhtarFormData = (
  value: unknown,
): PassportApplication["mukhtarFormData"] => {
  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;
  if (!parsed || typeof parsed !== "object") {
    return {
      address: "",
      district: "",
      mukhtarName: "",
      selectedMukhtarId: "",
    };
  }
  const obj = parsed as Record<string, unknown>;
  return {
    address: typeof obj.address === "string" ? obj.address : "",
    district: typeof obj.district === "string" ? obj.district : "",
    mukhtarName:
      typeof obj.mukhtarName === "string" ? obj.mukhtarName : "",
    selectedMukhtarId:
      typeof obj.selectedMukhtarId === "string" ? obj.selectedMukhtarId : "",
  };
};

const parseDocuments = (value: unknown): PassportApplication["documents"] => {
  if (!value || typeof value !== "object") {
    return {
      identityDocument: null,
      frontUrl: null,
      backUrl: null,
      civilRegistryExtract: null,
      passportPhoto: null,
      oldPassport: null,
    };
  }

  const obj = value as Record<string, unknown>;
  return {
    identityDocument:
      typeof obj.identityDocument === "string" ? obj.identityDocument : null,
    frontUrl: typeof obj.frontUrl === "string" ? obj.frontUrl : null,
    backUrl: typeof obj.backUrl === "string" ? obj.backUrl : null,
    civilRegistryExtract:
      typeof obj.civilRegistryExtract === "string"
        ? obj.civilRegistryExtract
        : null,
    passportPhoto:
      typeof obj.passportPhoto === "string" ? obj.passportPhoto : null,
    oldPassport: typeof obj.oldPassport === "string" ? obj.oldPassport : null,
  };
};

const inferIdentityDocumentTypeFromDocuments = (
  documents: PassportApplication["documents"],
): PassportApplication["identityDocumentType"] => {
  if (documents.frontUrl || documents.backUrl) return "NATIONAL_ID";
  if (documents.civilRegistryExtract) return "CIVIL_REGISTRY_EXTRACT";
  return null;
};

export const mapApiApplicationToFrontend = (raw: unknown): PassportApplication => {
  const c = snakeToCamel(raw) as Record<string, unknown>;
  const currentStatus = backendStatusToFrontend(
    (c.currentStatus as string) ?? "Pending",
  ) as PassportApplication["currentStatus"];
  const documents = parseDocuments(c.documents);
  return {
    applicationId: (c.applicationId as string) ?? "",
    userId: (c.citizenId as string) ?? "",
    applicationType: backendAppTypeToFrontend((c.applicationType as string) ?? ""),
    currentStatus,
    submissionDate: (c.createdAt as string) ?? new Date().toISOString(),
    trackingNumber: (c.trackingNumber as string) ?? "",
    passportValidity: 5,
    feeAmount: 0,
    paymentStatus: backendPaymentStatusToFrontend(
      (c.paymentStatus as string) ?? "Pending",
    ) as PassportApplication["paymentStatus"],
    identityDocumentType:
      c.identityDocumentType === "NATIONAL_ID" ||
      c.identityDocumentType === "CIVIL_REGISTRY_EXTRACT"
        ? c.identityDocumentType
        : inferIdentityDocumentTypeFromDocuments(documents),
    renewingPassportId: null,
    resubmissionReasons: parseResubmissionReasons(
      c.resubmissionReasons,
      currentStatus,
    ),
    documents,
    mukhtarFormData: parseMukhtarFormData(c.mukhtarFormData),
    biometricCaptured: false,
  };
};
