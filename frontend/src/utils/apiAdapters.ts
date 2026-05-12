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

// ─── Full application mapper ──────────────────────────────────────────────────

export const mapApiApplicationToFrontend = (raw: unknown): PassportApplication => {
  const c = snakeToCamel(raw) as Record<string, unknown>;
  return {
    applicationId: (c.applicationId as string) ?? "",
    userId: (c.citizenId as string) ?? "",
    applicationType: backendAppTypeToFrontend((c.applicationType as string) ?? ""),
    currentStatus: backendStatusToFrontend(
      (c.currentStatus as string) ?? "Pending",
    ) as PassportApplication["currentStatus"],
    submissionDate: (c.createdAt as string) ?? new Date().toISOString(),
    trackingNumber: (c.trackingNumber as string) ?? "",
    passportValidity: 5,
    feeAmount: 0,
    paymentStatus: backendPaymentStatusToFrontend(
      (c.paymentStatus as string) ?? "Pending",
    ) as PassportApplication["paymentStatus"],
    renewingPassportId: null,
    resubmissionReasons: null,
    documents: {
      identityDocument: null,
      passportPhoto: null,
      oldPassport: null,
    },
    mukhtarFormData: { address: "", district: "", mukhtarName: "" },
    biometricCaptured: false,
  };
};
