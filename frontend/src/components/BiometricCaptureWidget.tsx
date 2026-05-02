import { useEffect, useRef, useState } from "react";

export interface BiometricCaptureWidgetProps {
  onCaptureComplete: (result: {
    faceCaptured: boolean;
    fingerprintsCaptured: boolean;
  }) => void;
}

type Stage = "FACE" | "FINGERPRINT";

// SRS Table 4 — Face capture conditions
const FACE_CONDITIONS = [
  { key: "EYEWEAR", message: "Please remove your glasses." },
  { key: "OUT_OF_FRAME", message: "Position your face completely within the oval." },
  { key: "TURN_RIGHT", message: "Turn your head slowly to the right." },
  { key: "TURN_LEFT", message: "Turn your head slowly to the left." },
  {
    key: "PITCH_YAW_ROLL",
    message:
      "Look directly at the camera with a neutral expression and mouth closed.",
  },
  { key: "POOR_LIGHTING", message: "Move to a brighter, well-lit area." },
  { key: "MULTIPLE_FACES", message: "Ensure you are the only person in the frame." },
] as const;

// SRS Table 4 — Fingerprint capture conditions (excluding "Incorrect sequence",
// which is handled separately and displays the current expected step)
const FINGER_CONDITIONS = [
  {
    key: "MOTION_BLUR",
    message: "Hold your hand steady in front of the camera.",
  },
  {
    key: "FOCAL_DISTANCE",
    message: "Move your hand closer to the camera.",
  },
  {
    key: "LOW_LIGHTING",
    message: "Environment too dark, move to a brighter area.",
  },
  {
    key: "BACKGROUND_CLUTTER",
    message: "Please hold your hand against a plain, solid-colored background.",
  },
  {
    key: "FINGERS_NOT_JOINED",
    message: "Keep your fingers pressed flat and close together.",
  },
  { key: "INCORRECT_SEQUENCE", message: "" }, // filled with expected-step message
] as const;

const FINGER_SEQUENCE = [
  "Show all 4 fingers of the RIGHT hand.",
  "Show all 4 fingers of the LEFT hand.",
  "Both THUMBS.",
];

const ALL_CLEAR_MSG = "Perfect. Hold still for three seconds.";

const FEEDBACK_TICK_MS = 2500;
const TIMER_TICK_MS = 100;
const TIMER_DURATION_MS = 3000;
const FACE_ALL_CLEAR_PROB = 0.3;
const FINGER_ALL_CLEAR_PROB = 0.35;

interface Feedback {
  isAllClear: boolean;
  message: string;
  flashRed: boolean;
}

const BiometricCaptureWidget = ({
  onCaptureComplete,
}: BiometricCaptureWidgetProps) => {
  const [stage, setStage] = useState<Stage>("FACE");
  const [faceComplete, setFaceComplete] = useState(false);
  const [fingerStepIdx, setFingerStepIdx] = useState(0); // 0..2
  const [fingerComplete, setFingerComplete] = useState(false);

  const [feedback, setFeedback] = useState<Feedback>({
    isAllClear: false,
    message: "Initializing camera...",
    flashRed: false,
  });
  const [progress, setProgress] = useState(0); // 0..100
  const [processing, setProcessing] = useState(false);

  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedbackInterval = () => {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }
  };
  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };
  const clearAll = () => {
    clearFeedbackInterval();
    clearTimer();
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
  };

  useEffect(() => () => clearAll(), []);

  // Pick the next simulated condition for the current stage / sub-step.
  const pickFeedback = (): Feedback => {
    if (stage === "FACE") {
      if (Math.random() < FACE_ALL_CLEAR_PROB) {
        return { isAllClear: true, message: ALL_CLEAR_MSG, flashRed: false };
      }
      const c =
        FACE_CONDITIONS[Math.floor(Math.random() * FACE_CONDITIONS.length)];
      return { isAllClear: false, message: c.message, flashRed: false };
    }
    // FINGERPRINT
    if (Math.random() < FINGER_ALL_CLEAR_PROB) {
      return { isAllClear: true, message: ALL_CLEAR_MSG, flashRed: false };
    }
    const c =
      FINGER_CONDITIONS[Math.floor(Math.random() * FINGER_CONDITIONS.length)];
    const message =
      c.key === "INCORRECT_SEQUENCE" ? FINGER_SEQUENCE[fingerStepIdx] : c.message;
    return { isAllClear: false, message, flashRed: false };
  };

  // Stability timer — fills over 3 seconds at 100ms ticks
  const startTimer = () => {
    clearTimer();
    setProgress(0);
    timerIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (TIMER_TICK_MS / TIMER_DURATION_MS) * 100;
        if (next >= 100) {
          clearTimer();
          handleCaptureSuccess();
          return 100;
        }
        return next;
      });
    }, TIMER_TICK_MS);
  };

  const flashRed = () => {
    setFeedback((f) => ({ ...f, flashRed: true }));
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFeedback((f) => ({ ...f, flashRed: false }));
    }, 400);
  };

  const handleCaptureSuccess = () => {
    clearFeedbackInterval();
    setProcessing(true);
    setFeedback({
      isAllClear: true,
      message:
        stage === "FACE"
          ? "Capture successful. Processing..."
          : fingerStepIdx >= FINGER_SEQUENCE.length - 1
            ? "Fingerprint capture successful. Processing..."
            : "Capture successful. Processing...",
      flashRed: false,
    });

    transitionTimeoutRef.current = setTimeout(() => {
      setProcessing(false);
      if (stage === "FACE") {
        setFaceComplete(true);
        setStage("FINGERPRINT");
        setProgress(0);
      } else {
        if (fingerStepIdx < FINGER_SEQUENCE.length - 1) {
          setFingerStepIdx((i) => i + 1);
          setProgress(0);
        } else {
          setFingerComplete(true);
          onCaptureComplete({
            faceCaptured: true,
            fingerprintsCaptured: true,
          });
        }
      }
    }, 1000);
  };

  // Start / restart the simulated ML feedback loop for the current stage / sub-step.
  // Re-runs whenever stage or fingerStepIdx changes.
  useEffect(() => {
    if (processing) return;
    if (fingerComplete) return;

    setProgress(0);
    setFeedback({
      isAllClear: false,
      message:
        stage === "FACE"
          ? "Position your face within the oval to begin."
          : FINGER_SEQUENCE[fingerStepIdx],
      flashRed: false,
    });

    feedbackIntervalRef.current = setInterval(() => {
      const f = pickFeedback();
      setFeedback((prev) => {
        // If timer is running (we previously had ALL CLEAR) and the new feedback
        // is NOT all-clear, reset the timer and surface the reset message.
        if (prev.isAllClear && !f.isAllClear) {
          clearTimer();
          setProgress(0);
          flashRed();
          return {
            isAllClear: false,
            message: `${f.message} Timer reset. Please hold still.`,
            flashRed: true,
          };
        }
        return f;
      });

      if (f.isAllClear) {
        // Start the stability timer if not already running
        if (!timerIntervalRef.current) startTimer();
      }
    }, FEEDBACK_TICK_MS);

    return () => {
      clearFeedbackInterval();
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, fingerStepIdx]);

  // ── Visuals ───────────────────────────────────────────────────────────────

  const frameBorderClass = (() => {
    if (feedback.flashRed) return "border-red-500";
    if (feedback.isAllClear || progress > 0) return "border-green-500 border-solid";
    return "border-gray-400 border-dashed";
  })();

  const frameGlow =
    feedback.isAllClear && !feedback.flashRed
      ? { boxShadow: "0 0 24px rgba(34, 197, 94, 0.5)" }
      : undefined;

  const arcRadius = 50;
  const arcCirc = 2 * Math.PI * arcRadius;
  const arcDashOffset = arcCirc - (progress / 100) * arcCirc;

  return (
    <div className="space-y-5">
      {/* Stage progress indicator */}
      <div className="flex items-center justify-center gap-4">
        <StageStep
          label="Face Capture"
          state={
            faceComplete ? "complete" : stage === "FACE" ? "active" : "pending"
          }
          icon="face"
        />
        <div
          className={`h-0.5 w-10 ${faceComplete ? "bg-green-500" : "bg-gray-300"}`}
        />
        <StageStep
          label="Fingerprint Capture"
          state={
            fingerComplete
              ? "complete"
              : stage === "FINGERPRINT"
                ? "active"
                : "pending"
          }
          icon="fingerprint"
        />
      </div>

      {/* Frame */}
      <div className="flex flex-col items-center">
        {stage === "FACE" ? (
          <div
            className={`relative border-4 ${frameBorderClass} transition-colors duration-200`}
            style={{
              width: 280,
              height: 360,
              borderRadius: "50%",
              ...frameGlow,
            }}
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 280 360"
            >
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                className="fill-gray-300"
                fontSize="80"
                dominantBaseline="middle"
              >
                {feedback.isAllClear ? "✓" : "👤"}
              </text>
            </svg>
          </div>
        ) : (
          <div
            className={`relative border-4 ${frameBorderClass} rounded-md transition-colors duration-200 flex items-center justify-center`}
            style={{ width: 280, height: 200, ...frameGlow }}
          >
            <span className="text-6xl text-gray-300">
              {feedback.isAllClear ? "✓" : "✋"}
            </span>
          </div>
        )}

        {/* Stability timer arc */}
        <div className="mt-4 relative w-28 h-28">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={arcRadius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r={arcRadius}
              fill="none"
              stroke="#22c55e"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={arcCirc}
              strokeDashoffset={arcDashOffset}
              style={{ transition: "stroke-dashoffset 100ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono text-gray-700">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Instruction text */}
      <div
        className={`p-3 rounded-md text-center text-sm font-medium flex items-center justify-center gap-2 ${
          feedback.isAllClear
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-amber-50 text-amber-800 border border-amber-200"
        }`}
      >
        <span className="text-base">{feedback.isAllClear ? "✓" : "⚠"}</span>
        <span>{feedback.message}</span>
      </div>

      {/* Sub-step indicator for fingerprints */}
      {stage === "FINGERPRINT" && !fingerComplete && (
        <p className="text-center text-xs text-gray-500">
          Step {fingerStepIdx + 1} of {FINGER_SEQUENCE.length} —{" "}
          {FINGER_SEQUENCE[fingerStepIdx]}
        </p>
      )}
    </div>
  );
};

// ─── Stage step pill ────────────────────────────────────────────────────────

const StageStep = ({
  label,
  state,
  icon,
}: {
  label: string;
  state: "active" | "complete" | "pending";
  icon: "face" | "fingerprint";
}) => {
  const colorClasses =
    state === "complete"
      ? "bg-green-100 text-green-700 border-green-300"
      : state === "active"
        ? "bg-blue-100 text-blue-700 border-blue-300"
        : "bg-gray-100 text-gray-400 border-gray-200";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClasses}`}
    >
      <span className="text-base">
        {state === "complete" ? "✓" : icon === "face" ? "😊" : "👆"}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
};

export default BiometricCaptureWidget;
