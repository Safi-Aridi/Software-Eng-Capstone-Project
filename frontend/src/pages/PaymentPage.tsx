import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import { authService } from "../services/authService";
import {
  applicationService,
  type PassportApplication,
} from "../services/applicationService";
import {
  paymentService,
  type PaymentOutcome,
} from "../services/paymentService";
import { receiptService } from "../services/receiptService";

const PaymentPage = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const [application, setApplication] = useState<PassportApplication | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [countdownPaused, setCountdownPaused] = useState(false);
  const [receiptDownloaded, setReceiptDownloaded] = useState(false);

  // Load application on mount
  useEffect(() => {
    if (!currentUser || !applicationId) {
      navigate("/citizen/dashboard");
      return;
    }

    applicationService
      .getApplicationById(currentUser.user.id, applicationId)
      .then((app) => {
        if (!app || app.paymentStatus === "Paid") {
          navigate("/citizen/dashboard");
          return;
        }
        setApplication(app);
        setIsLoading(false);
      });
  }, []);

  // Block in-app navigation while payment is still pending
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      outcome === null &&
      !isLoading &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  // Success auto-redirect countdown — pauses if the citizen clicks Download Receipt
  useEffect(() => {
    if (outcome !== "SUCCESS" || countdownPaused) return;
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          navigate("/citizen/dashboard", {
            state: {
              successMessage: `Payment successful! Your application ${application?.trackingNumber} is now being processed.`,
            },
          });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [outcome, countdownPaused]);

  const handlePay = async () => {
    if (!application || !currentUser) return;
    setIsPaying(true);
    const result = await paymentService.initiatePayment(
      application.applicationId,
      application.feeAmount,
      currentUser.user.id,
    );
    setIsPaying(false);
    setOutcome(result);
    // Refresh application record so paymentStatus reflects the update
    const updated = await applicationService.getApplicationById(
      currentUser.user.id,
      application.applicationId,
    );
    if (updated) setApplication(updated);
  };

  const handleDownloadReceipt = async () => {
    if (!application) return;
    // Pause the auto-redirect immediately so the user has full control
    setCountdownPaused(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setIsGeneratingReceipt(true);
    setReceiptError(null);
    try {
      await receiptService.generateReceipt(application.applicationId);
      setReceiptDownloaded(true);
    } catch {
      setReceiptError("Receipt generation failed. Please try again.");
      setTimeout(() => setReceiptError(null), 3000);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const handleGoToDashboard = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    navigate("/citizen/dashboard", {
      state: {
        successMessage: `Payment successful! Your application ${application?.trackingNumber} is now being processed.`,
      },
    });
  };

  const handleRetry = () => {
    setOutcome(null);
    setCountdown(3);
    handlePay();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!application) return null;

  const feeFormatted = application.feeAmount.toLocaleString();
  const validityLabel =
    application.passportValidity === 5 ? "5 Years" : "10 Years";
  const typeLabel =
    application.applicationType === "NEW" ? "New Passport" : "Passport Renewal";
  const submittedLabel = new Date(application.submissionDate).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long", year: "numeric" },
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full">
        {/* Page header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Complete Payment</h1>
          <p className="text-gray-500 text-sm mt-1">
            Finalize your passport application fee via CashPlus
          </p>
        </div>

        {/* Payment summary card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
          <div className="bg-gray-800 px-6 py-4">
            <p className="text-gray-300 text-xs uppercase tracking-wide">
              Amount Due
            </p>
            <p className="text-white text-3xl font-bold mt-1">
              {feeFormatted}{" "}
              <span className="text-lg font-normal text-gray-300">LBP</span>
            </p>
          </div>

          <div className="px-6 py-5 space-y-3">
            <SummaryRow label="Tracking Number" value={application.trackingNumber} mono />
            <SummaryRow label="Application Type" value={typeLabel} />
            <SummaryRow label="Passport Validity" value={validityLabel} />
            <SummaryRow label="Submitted" value={submittedLabel} />
          </div>

          {/* CashPlus branding placeholder */}
          <div className="mx-6 mb-5 p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                CashPlus Secure Gateway
              </p>
              <p className="text-xs text-gray-500">
                Payment is processed securely via CashPlus
              </p>
            </div>
          </div>
        </div>

        {/* Outcome panels */}
        {outcome === null && !isPaying && (
          <div className="space-y-3">
            <button
              onClick={handlePay}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Pay Now
            </button>
            <button
              onClick={() => navigate("/citizen/dashboard")}
              className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Cancel — Return to Dashboard
            </button>
          </div>
        )}

        {isPaying && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
            <p className="text-gray-700 font-medium">
              Connecting to CashPlus gateway...
            </p>
            <p className="text-gray-400 text-sm mt-1">Please do not close this page</p>
          </div>
        )}

        {outcome === "SUCCESS" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-green-600"
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
            </div>
            <h2 className="text-lg font-bold text-green-800 mb-1">
              Payment Successful
            </h2>
            <p className="text-green-700 text-sm mb-3">
              Your application is now being processed.
            </p>
            <p className="text-green-600 text-xs font-mono mb-4">
              {application.trackingNumber}
            </p>
            <button
              onClick={handleDownloadReceipt}
              disabled={isGeneratingReceipt}
              className="w-full mb-3 border border-green-600 text-green-700 py-2.5 rounded-lg font-medium hover:bg-green-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGeneratingReceipt
                ? "Generating..."
                : receiptDownloaded
                  ? "Download Receipt Again"
                  : "Download Receipt"}
            </button>
            {receiptError && (
              <p className="text-red-600 text-xs mb-2">{receiptError}</p>
            )}
            {countdownPaused ? (
              <p className="text-green-700 text-sm mb-3">
                {receiptDownloaded
                  ? "Download complete. Continue when ready."
                  : "Auto-redirect paused."}
              </p>
            ) : (
              <p className="text-green-600 text-sm mb-3">
                Redirecting to dashboard in{" "}
                <span className="font-bold">{countdown}</span> second
                {countdown === 1 ? "" : "s"}...
              </p>
            )}
            <button
              onClick={handleGoToDashboard}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {outcome === "FAILED" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-3 gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-red-800">
                  Payment Failed
                </h2>
                <p className="text-red-600 text-sm">
                  Your application has been saved. Please retry.
                </p>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <button
                onClick={handleRetry}
                className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Retry Payment
              </button>
              <button
                onClick={() => navigate("/citizen/dashboard")}
                className="w-full text-red-600 text-sm hover:text-red-800 transition-colors py-1"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {blocker.state === "blocked" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Leave this page?
              </h3>
              <p className="text-gray-600 text-sm mb-5">
                You have an unpaid application. Are you sure you want to leave?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => blocker.reset?.()}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Stay
                </button>
                <button
                  onClick={() => blocker.proceed?.()}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}

        {outcome === "GATEWAY_UNAVAILABLE" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-center mb-3 gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-800">
                  Service Unavailable
                </h2>
                <p className="text-amber-700 text-sm">
                  CashPlus gateway is currently unreachable.
                </p>
              </div>
            </div>
            <p className="text-amber-700 text-sm mb-4">
              Your application has been saved and no payment was attempted.
              Please return to your dashboard to retry when the service is
              available.
            </p>
            <button
              onClick={() => navigate("/citizen/dashboard")}
              className="w-full bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryRow = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-gray-500">{label}</span>
    <span className={`text-gray-800 font-medium ${mono ? "font-mono" : ""}`}>
      {value}
    </span>
  </div>
);

export default PaymentPage;
