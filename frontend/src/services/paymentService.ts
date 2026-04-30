// Handles FR-09 (fee transmission), FR-28/29/30 (payment callbacks)

export interface PaymentRecord {
  paymentId: string;
  applicationId: string;
  amount: number;
  currency: "LBP";
  status: "PENDING" | "PAID" | "FAILED";
  initiatedAt: string;
  confirmedAt: string | null;
}

const paymentKey = (applicationId: string) => `payment_${applicationId}`;

export const paymentService = {
  // FR-09 — Initiate fee payment via CashPlus gateway
  // TODO: POST /api/payments/initiate → transmit to CashPlus gateway (FR-09)
  initiatePayment: async (
    applicationId: string,
    amount: number,
  ): Promise<PaymentRecord> => {
    const record: PaymentRecord = {
      paymentId: "pay_" + Date.now(),
      applicationId,
      amount,
      currency: "LBP",
      status: "PENDING",
      initiatedAt: new Date().toISOString(),
      confirmedAt: null,
    };
    localStorage.setItem(paymentKey(applicationId), JSON.stringify(record));

    // Simulate async CashPlus success callback after 2 seconds (FR-28, FR-29)
    setTimeout(
      () => paymentService.simulatePaymentCallback(applicationId, true),
      2000,
    );

    return record;
  },

  // TODO: GET /api/payments/:applicationId/status
  getPaymentStatus: async (
    applicationId: string,
  ): Promise<PaymentRecord | null> => {
    const stored = localStorage.getItem(paymentKey(applicationId));
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  // Mock only — simulates CashPlus webhook callback (FR-28, FR-29)
  // TODO: Remove — real callbacks come from CashPlus to backend webhook endpoint
  simulatePaymentCallback: (
    applicationId: string,
    success: boolean,
  ): void => {
    const stored = localStorage.getItem(paymentKey(applicationId));
    if (!stored) return;
    try {
      const record: PaymentRecord = JSON.parse(stored);
      const updated: PaymentRecord = {
        ...record,
        status: success ? "PAID" : "FAILED",
        confirmedAt: new Date().toISOString(),
      };
      localStorage.setItem(paymentKey(applicationId), JSON.stringify(updated));
    } catch {
      // skip
    }
  },
};
