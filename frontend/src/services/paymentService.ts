// Handles FR-09 (fee transmission), FR-28/29/30 (payment callbacks)

import { notificationService } from "./notificationService";

export type PaymentOutcome = "SUCCESS" | "FAILED" | "GATEWAY_UNAVAILABLE";

export interface PaymentRecord {
  applicationId: string;
  userId: string;
  amount: number;
  status: "UNPAID" | "Paid" | "Failed";
  initiatedAt: string | null;
  resolvedAt: string | null;
  gatewayRef: string | null;
}

const paymentKey = (applicationId: string) => `payment_${applicationId}`;
const appsKey = (userId: string) => `applications_${userId}`;

const getRecord = (applicationId: string): PaymentRecord | null => {
  const stored = localStorage.getItem(paymentKey(applicationId));
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

// Internal — updates paymentStatus on the PassportApplication record in localStorage
const updateAppPaymentStatus = (
  userId: string,
  applicationId: string,
  status: "UNPAID" | "Paid" | "Failed",
): void => {
  const key = appsKey(userId);
  const stored = localStorage.getItem(key);
  if (!stored) return;
  try {
    const apps = JSON.parse(stored);
    const idx = apps.findIndex(
      (a: { applicationId: string }) => a.applicationId === applicationId,
    );
    if (idx >= 0) {
      apps[idx].paymentStatus = status;
      localStorage.setItem(key, JSON.stringify(apps));
    }
  } catch {
    // skip malformed data
  }
};

export const paymentService = {
  // FR-09 — Transmit fee to CashPlus gateway and simulate outcome
  // TODO: POST /api/payments/initiate → transmit applicationId, amount, userId to CashPlus gateway
  initiatePayment: async (
    applicationId: string,
    amount: number,
    userId: string,
  ): Promise<PaymentOutcome> => {
    const record: PaymentRecord = {
      applicationId,
      userId,
      amount,
      status: "UNPAID",
      initiatedAt: new Date().toISOString(),
      resolvedAt: null,
      gatewayRef: null,
    };
    localStorage.setItem(paymentKey(applicationId), JSON.stringify(record));

    // Simulate 2s gateway transmission delay (FR-09)
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    // Weighted outcome: 75% SUCCESS, 15% FAILED, 10% GATEWAY_UNAVAILABLE
    const rand = Math.random();
    let outcome: PaymentOutcome;
    if (rand < 0.75) {
      outcome = "SUCCESS";
    } else if (rand < 0.9) {
      outcome = "FAILED";
    } else {
      outcome = "GATEWAY_UNAVAILABLE";
    }

    if (outcome === "SUCCESS") {
      // FR-28 — successful callback
      const updated: PaymentRecord = {
        ...record,
        status: "Paid",
        resolvedAt: new Date().toISOString(),
        gatewayRef: `CASHPLUS-MOCK-${Math.floor(10000000 + Math.random() * 90000000)}`,
      };
      localStorage.setItem(paymentKey(applicationId), JSON.stringify(updated));
      updateAppPaymentStatus(userId, applicationId, "Paid");
    } else if (outcome === "FAILED") {
      // FR-29 — failed callback: update status and notify citizen
      const updated: PaymentRecord = {
        ...record,
        status: "Failed",
        resolvedAt: new Date().toISOString(),
        gatewayRef: null,
      };
      localStorage.setItem(paymentKey(applicationId), JSON.stringify(updated));
      updateAppPaymentStatus(userId, applicationId, "Failed");
      notificationService.addNotification(userId, {
        type: "STATUS_UPDATE",
        message:
          "Your payment has failed. Your application is saved — please retry payment from your dashboard.",
        applicationId,
        userId,
      });
    }
    // GATEWAY_UNAVAILABLE: do NOT change any application data (FR-09 exception)

    return outcome;
  },

  // TODO: GET /api/payments/:applicationId/status
  getPaymentStatus: async (
    applicationId: string,
  ): Promise<{ status: "UNPAID" | "Paid" | "Failed"; initiatedAt?: string }> => {
    const record = getRecord(applicationId);
    if (!record) return { status: "UNPAID" };
    return {
      status: record.status,
      initiatedAt: record.initiatedAt ?? undefined,
    };
  },

  // FR-30 — Auto-fail UNPAID applications older than 15 minutes on dashboard load
  // TODO: Replace with server-side cron job that handles FR-30 automatically
  checkExpiredPayments: async (userId: string): Promise<void> => {
    const stored = localStorage.getItem(appsKey(userId));
    if (!stored) return;
    try {
      const apps = JSON.parse(stored);
      const now = Date.now();
      const fifteenMin = 15 * 60 * 1000;
      let changed = false;

      for (const app of apps) {
        if (app.paymentStatus === "UNPAID") {
          const submittedAt = new Date(app.submissionDate).getTime();
          if (now - submittedAt > fifteenMin) {
            app.paymentStatus = "Failed";
            // Update payment record if one exists
            const rec = getRecord(app.applicationId);
            if (rec) {
              localStorage.setItem(
                paymentKey(app.applicationId),
                JSON.stringify({
                  ...rec,
                  status: "Failed",
                  resolvedAt: new Date().toISOString(),
                }),
              );
            }
            notificationService.addNotification(userId, {
              type: "STATUS_UPDATE",
              message: `Payment timed out for application ${app.trackingNumber}. Your application is saved — please retry payment from your dashboard.`,
              applicationId: app.applicationId,
              userId,
            });
            changed = true;
          }
        }
      }

      if (changed) {
        localStorage.setItem(appsKey(userId), JSON.stringify(apps));
      }
    } catch {
      // skip malformed entries
    }
  },
};
