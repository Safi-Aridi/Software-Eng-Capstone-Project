// Handles receipt PDF generation for paid applications.
// TODO: When backend is integrated, replace with API call to GET /api/applications/:id/receipt
// that returns a server-generated, signed PDF for non-repudiation.

import jsPDF from "jspdf";
import { getIdentityForUser } from "./applicationService";
import type { PassportApplication } from "./applicationService";

const STATUS_LABELS: Record<PassportApplication["currentStatus"], string> = {
  PENDING_REVIEW: "Pending Review",
  VERIFIED: "Verified",
  MUKHTAR_SIGNED: "Mukhtar Signed",
  PROCESSED: "Processed",
  RESUBMISSION_REQUIRED: "Resubmission Required",
  DELIVERED: "Delivered",
};

interface PaymentRecord {
  applicationId: string;
  userId: string;
  amount: number;
  status: "UNPAID" | "Paid" | "Failed";
  initiatedAt: string | null;
  resolvedAt: string | null;
  gatewayRef: string | null;
}

// TODO: Replace with paymentService.getPaymentRecord(applicationId) once exposed.
const readPaymentRecord = (applicationId: string): PaymentRecord | null => {
  const stored = localStorage.getItem(`payment_${applicationId}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as PaymentRecord;
  } catch {
    return null;
  }
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "long" });
  const year = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
};

const findApplicationCrossUser = (
  applicationId: string,
): PassportApplication | null => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("applications_")) continue;
    try {
      const apps: PassportApplication[] = JSON.parse(
        localStorage.getItem(key) || "[]",
      );
      const found = apps.find((a) => a.applicationId === applicationId);
      if (found) return found;
    } catch {
      // skip malformed
    }
  }
  return null;
};

export const receiptService = {
  // TODO: Replace with GET /api/applications/:id/receipt — server-generated signed PDF.
  generateReceipt: async (applicationId: string): Promise<void> => {
    const app = findApplicationCrossUser(applicationId);
    if (!app) throw new Error("Application not found");

    const payment = readPaymentRecord(applicationId);
    if (!payment || payment.status !== "Paid") {
      throw new Error("Payment record missing or not paid");
    }

    const identity = getIdentityForUser(app.userId);
    const fullName = identity?.fullName ?? "—";

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 48;
    let y = 56;

    // Header band (Lebanese red accent)
    doc.setFillColor(206, 17, 38);
    doc.rect(0, 0, pageWidth, 6, "F");

    // Header text — serif
    doc.setFont("times", "bold");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(13);
    doc.text(
      "Republic of Lebanon — General Directorate of General Security",
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 22;
    doc.setFontSize(16);
    doc.text("Passport Application Receipt", pageWidth / 2, y, {
      align: "center",
    });
    y += 28;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 28;

    // Tracking number — prominent
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("TRACKING NUMBER", marginX, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 20);
    doc.text(app.trackingNumber, marginX, y);
    y += 28;

    // Application details section
    const drawRow = (label: string, value: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(label.toUpperCase(), marginX, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(value, marginX + 180, y);
      y += 22;
    };

    drawRow("Applicant Full Name", fullName);
    drawRow(
      "Application Type",
      app.applicationType === "NEW" ? "NEW" : "RENEWAL",
    );
    drawRow(
      "Passport Validity",
      app.passportValidity === 5 ? "5 years" : "10 years",
    );
    drawRow("Submission Date", formatDateTime(app.submissionDate));

    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 22;

    // Payment section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("Payment", marginX, y);
    y += 22;

    drawRow("Fee Amount", `${app.feeAmount.toLocaleString()} LBP`);
    drawRow("Payment Status", "Paid");
    drawRow("Payment Reference", payment.gatewayRef ?? "—");
    drawRow(
      "Payment Date",
      payment.resolvedAt ? formatDateTime(payment.resolvedAt) : "—",
    );

    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 22;

    // Current status
    drawRow(
      "Current Application Status",
      STATUS_LABELS[app.currentStatus] ?? app.currentStatus,
    );

    // Footer
    const footerY = pageHeight - 70;
    doc.setDrawColor(220, 220, 220);
    doc.line(marginX, footerY - 12, pageWidth - marginX, footerY - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "This is a computer-generated receipt. No signature is required.",
      pageWidth / 2,
      footerY,
      { align: "center" },
    );
    doc.text(
      `Generated on ${formatDateTime(new Date().toISOString())}`,
      pageWidth / 2,
      footerY + 14,
      { align: "center" },
    );
    doc.text(
      "Track your application at: https://npis.gov.lb/track",
      pageWidth / 2,
      footerY + 28,
      { align: "center" },
    );

    doc.save(`NPIS_Receipt_${app.trackingNumber}.pdf`);
  },
};
