import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

type Step = "FORM" | "OTP";

const OTP_LENGTH = 6;
const OTP_DURATION_SEC = 5 * 60;

const formatCountdown = (totalSec: number): string => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const CitizenSignupPage = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    mobileNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("FORM");

  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "mobileNumber") {
      if (/^\d*$/.test(value)) {
        setFormData((prev) => ({
          ...prev,
          mobileNumber: value.slice(0, 8),
        }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.mobileNumber ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("All fields are required");
      return;
    }

    if (formData.mobileNumber.length !== 8) {
      setError("Mobile number must contain exactly 8 digits");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    authService.generateOtp(formData.mobileNumber);
    setStep("OTP");
  };

  const handleOtpSuccess = async () => {
    setIsLoading(true);
    setError("");

    try {
  await authService.register({
  first_name: formData.firstName,
  last_name: formData.lastName,
  phone: formData.mobileNumber,
  email: formData.email,
  password: formData.password,
});

      alert(
        "Account created successfully! Please complete identity verification to use passport services."
      );

      navigate("/identity-verification");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setStep("FORM");
    } finally {
      setIsLoading(false);
    }
  };

  const restart = () => {
    authService.clearOtp(formData.mobileNumber);
    setStep("FORM");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Create Citizen Account
            </h1>

            <p className="text-gray-600">
              {step === "FORM"
                ? "Register for passport application services"
                : "Verify your mobile number to continue"}
            </p>
          </div>

          {step === "FORM" && (
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]{8}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter 8-digit mobile number"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter exactly 8 numerical digits
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Create password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Send OTP
              </button>
            </form>
          )}

          {step === "OTP" && (
            <OtpStep
              mobile={formData.mobileNumber}
              onSuccess={handleOtpSuccess}
              onRestart={restart}
              isSubmitting={isLoading}
            />
          )}

          <div className="mt-6 text-center">
            <span className="text-gray-600">Already have an account? </span>
            <a href="/" className="text-blue-600 hover:underline font-medium">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OtpStepProps {
  mobile: string;
  onSuccess: () => void;
  onRestart: () => void;
  isSubmitting: boolean;
}

const OtpStep = ({
  mobile,
  onSuccess,
  onRestart,
  isSubmitting,
}: OtpStepProps) => {
  const [digits, setDigits] = useState<string[]>(() =>
    Array(OTP_LENGTH).fill("")
  );

  const [secondsLeft, setSecondsLeft] = useState(OTP_DURATION_SEC);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorKind, setErrorKind] = useState<
    "INVALID" | "EXPIRED" | "LOCKED" | null
  >(null);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(id);
  }, [secondsLeft]);

  const expired = secondsLeft <= 0;
  const locked = errorKind === "LOCKED";

  const resetInputs = () => {
    setDigits(Array(OTP_LENGTH).fill(""));
    submittedRef.current = false;
    inputsRef.current[0]?.focus();
  };

  const submit = (entered: string) => {
    if (submittedRef.current) return;

    submittedRef.current = true;

    const result = authService.validateOtp(mobile, entered);

    if (result === "SUCCESS") {
      setErrorKind(null);
      setErrorMsg("");
      onSuccess();
      return;
    }

    if (result === "LOCKED") {
      setErrorKind("LOCKED");
      setErrorMsg("Too many incorrect attempts. Please restart registration.");
      return;
    }

    if (result === "EXPIRED") {
      setErrorKind("EXPIRED");
      setErrorMsg("Your code has expired.");
      setSecondsLeft(0);
      resetInputs();
      return;
    }

    const attempts = authService.getOtpAttempts(mobile);
    const remaining = Math.max(0, 3 - attempts);

    setErrorKind("INVALID");
    setErrorMsg(`Incorrect code. ${remaining} attempts remaining.`);
    resetInputs();
  };

  const handleChange = (idx: number, value: string) => {
    if (locked) return;

    const ch = value.replace(/\D/g, "").slice(-1);

    setDigits((prev) => {
      const next = [...prev];
      next[idx] = ch;

      if (ch && idx < OTP_LENGTH - 1) {
        inputsRef.current[idx + 1]?.focus();
      }

      if (next.every((d) => d.length === 1)) {
        setTimeout(() => submit(next.join("")), 0);
      }

      return next;
    });
  };

  const handleKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        setDigits((prev) => {
          const next = [...prev];
          next[idx] = "";
          return next;
        });
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();

        setDigits((prev) => {
          const next = [...prev];
          next[idx - 1] = "";
          return next;
        });
      }
    }
  };

  const handleResend = () => {
    authService.generateOtp(mobile);
    setSecondsLeft(OTP_DURATION_SEC);
    setErrorKind(null);
    setErrorMsg("");
    resetInputs();
  };

  const canResend = expired || errorKind === "EXPIRED";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-700">
          Enter the 6-digit code sent to{" "}
          <span className="font-semibold">{mobile}</span>
        </p>
      </div>

      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={locked || isSubmitting}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-12 h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          />
        ))}
      </div>

      <div className="text-center text-sm">
        {expired ? (
          <span className="text-amber-700">Code has expired</span>
        ) : (
          <span className="text-gray-600">
            Code expires in{" "}
            <span className="font-mono font-medium">
              {formatCountdown(secondsLeft)}
            </span>
          </span>
        )}
      </div>

      {errorMsg && (
        <div
          className={`rounded-md p-3 border text-sm ${
            errorKind === "EXPIRED"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        {locked ? (
          <button
            type="button"
            onClick={onRestart}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
          >
            Start Over
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend || isSubmitting}
            className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
          >
            Resend Code
          </button>
        )}

        {!locked && (
          <button
            type="button"
            onClick={onRestart}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Back to registration form
          </button>
        )}
      </div>

      {isSubmitting && (
        <p className="text-center text-sm text-gray-500">Creating account…</p>
      )}
    </div>
  );
};

export default CitizenSignupPage;