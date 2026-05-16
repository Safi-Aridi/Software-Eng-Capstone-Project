import { useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import {
  captureAndUploadFrames,
  saveBiometricFrameUrls,
  type CapturePosition,
} from "../services/biometricUploadService";

export interface BiometricCaptureWidgetProps {
  applicationId: string;
  onCaptureComplete: (result: {
    faceCaptured: boolean;
    fingerprintsCaptured: boolean;
  }) => void;
}

const TIMER_TICK_MS = 100;
const TIMER_DURATION_MS = 3000;
const CAPTURE_TIMER_DURATION_MS = 5000;
const ALL_CLEAR_MSG = "Perfect. Hold still for three seconds.";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const CAPTURE_SEQUENCE: CapturePosition[] = ["center", "right", "left"];
const POSITION_HOLD_MS = 900;
const POSITION_YAW_RANGES: Record<
  CapturePosition,
  { min: number; max: number }
> = {
  center: { min: -14, max: 14 },
  right: { min: -45, max: -16 },
  left: { min: 16, max: 45 },
};

const POSITION_INSTRUCTIONS: Record<CapturePosition, string> = {
  center: "Perfect. Hold still — capturing...",
  right: "Turn right and hold still — capturing...",
  left: "Turn left and hold still — capturing...",
};

const POSITION_WAITING: Record<CapturePosition, string> = {
  center: "Face the camera straight on.",
  right: "Turn your head slowly to the right.",
  left: "Turn your head slowly to the left.",
};

interface Feedback {
  isAllClear: boolean;
  message: string;
  flashRed: boolean;
}

type LivenessState =
  | "waiting_right"
  | "turned_right"
  | "waiting_left"
  | "done";

type CapturePhase = "liveness" | "positioning" | "capturing" | "saving" | "done";

const yawInRange = (yaw: number, position: CapturePosition): boolean => {
  const range = POSITION_YAW_RANGES[position];
  return yaw >= range.min && yaw <= range.max;
};

const getPositionInstruction = (
  position: CapturePosition,
  yaw: number,
): string => {
  const range = POSITION_YAW_RANGES[position];
  if (yawInRange(yaw, position)) return `Hold ${position} position...`;
  if (position === "center") return "Face the camera straight on.";
  if (position === "right") {
    return yaw > range.max
      ? "Turn your head slowly to the right."
      : "Turn slightly back toward the camera.";
  }
  return yaw < range.min
    ? "Turn your head slowly to the left."
    : "Turn slightly back toward the camera.";
};

const BiometricCaptureWidget = ({
  applicationId,
  onCaptureComplete,
}: BiometricCaptureWidgetProps) => {
  const [faceComplete, setFaceComplete] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    isAllClear: false,
    message: "Initializing camera...",
    flashRed: false,
  });
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const [capturePhase, setCapturePhase] = useState<CapturePhase>("liveness");
  const [currentPosition, setCurrentPosition] =
    useState<CapturePosition | null>(null);
  const [capturedPositions, setCapturedPositions] = useState<CapturePosition[]>(
    [],
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const livenessRef = useRef<{ state: LivenessState; completed: boolean }>({
    state: "waiting_right",
    completed: false,
  });
  const yawRef = useRef(0);
  const smoothedYawRef = useRef<number | null>(null);
  const capturePhaseRef = useRef<CapturePhase>("liveness");
  const currentPositionRef = useRef<CapturePosition | null>(null);
  const allFramePathsRef = useRef<string[]>([]);
  const captureInProgressRef = useRef(false);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const completedRef = useRef(false);

  useEffect(() => {
    capturePhaseRef.current = capturePhase;
  }, [capturePhase]);
  useEffect(() => {
    currentPositionRef.current = currentPosition;
    smoothedYawRef.current = null;
  }, [currentPosition]);

  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };
  const clearCaptureTimer = () => {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  };

  const flashRed = () => {
    setFeedback((f) => ({ ...f, flashRed: true }));
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFeedback((f) => ({ ...f, flashRed: false }));
    }, 400);
  };

  // ── Liveness-phase 3-second stability timer ──────────────────────────────
  const startLivenessTimer = () => {
    clearTimer();
    setProgress(0);
    timerIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (TIMER_TICK_MS / TIMER_DURATION_MS) * 100;
        if (next >= 100) {
          clearTimer();
          handleLivenessSuccess();
          return 100;
        }
        return next;
      });
    }, TIMER_TICK_MS);
  };

  const handleLivenessSuccess = () => {
    // Liveness phase done — move into positioning for the first capture.
    setProgress(0);
    setCapturePhase("positioning");
    setCurrentPosition(CAPTURE_SEQUENCE[0]);
  };

  // ── Capture phase ─────────────────────────────────────────────────────────
  const runCaptureForPosition = async (position: CapturePosition) => {
    if (!videoRef.current || !canvasRef.current) return;
    if (
      captureInProgressRef.current ||
      capturePhaseRef.current !== "positioning"
    ) {
      return;
    }
    captureInProgressRef.current = true;
    capturePhaseRef.current = "capturing";
    setCapturePhase("capturing");
    setFeedback({
      isAllClear: true,
      message: POSITION_INSTRUCTIONS[position],
      flashRed: false,
    });

    // Visible 5-second capture timer (does not gate the actual upload —
    // captureAndUploadFrames manages its own per-frame timing).
    clearCaptureTimer();
    setProgress(0);
    const tickMs = 100;
    captureTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (tickMs / CAPTURE_TIMER_DURATION_MS) * 100;
        return Math.min(100, next);
      });
    }, tickMs);

    try {
      const paths = await captureAndUploadFrames(
        applicationId,
        position,
        videoRef.current,
        canvasRef.current,
        3,
      );
      clearCaptureTimer();
      setProgress(100);
      allFramePathsRef.current.push(...paths);

      // Brief "Position captured ✓" pause
      setFeedback({
        isAllClear: true,
        message: `${position[0].toUpperCase()}${position.slice(1)} position captured ✓`,
        flashRed: false,
      });
      setCapturedPositions((prev) => [...prev, position]);

      await new Promise((r) => setTimeout(r, 500));

      // Next position?
      const idx = CAPTURE_SEQUENCE.indexOf(position);
      const nextPos = CAPTURE_SEQUENCE[idx + 1] ?? null;
      if (nextPos) {
        setProgress(0);
        setCurrentPosition(nextPos);
        capturePhaseRef.current = "positioning";
        captureInProgressRef.current = false;
        setCapturePhase("positioning");
        setFeedback({
          isAllClear: false,
          message: POSITION_WAITING[nextPos],
          flashRed: false,
        });
      } else {
        // All positions captured — save and finish
        await finishCapture();
      }
    } catch (err) {
      console.error("[BiometricCaptureWidget] capture failed", err);
      clearCaptureTimer();
      setProgress(0);
      setFeedback({
        isAllClear: false,
        message: "Upload failed. Please try again.",
        flashRed: true,
      });
      capturePhaseRef.current = "positioning";
      captureInProgressRef.current = false;
      setCapturePhase("positioning");
    }
  };

  const finishCapture = async () => {
    setCapturePhase("saving");
    setFeedback({
      isAllClear: true,
      message: "Processing...",
      flashRed: false,
    });
    try {
      await saveBiometricFrameUrls(applicationId, allFramePathsRef.current);
    } catch (err) {
      console.error("[BiometricCaptureWidget] saveBiometricFrameUrls", err);
    }
    await new Promise((r) => setTimeout(r, 1000));
    if (completedRef.current) return;
    completedRef.current = true;
    setCapturePhase("done");
    setFaceComplete(true);
    onCaptureComplete({ faceCaptured: true, fingerprintsCaptured: true });
  };

  // ── Brightness sampling ──────────────────────────────────────────────────
  const sampleBrightness = (
    canvas: HTMLCanvasElement,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): number | null => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const w = canvas.width;
    const h = canvas.height;
    const sx = Math.max(0, Math.floor(minX * w));
    const sy = Math.max(0, Math.floor(minY * h));
    const sw = Math.max(1, Math.floor((maxX - minX) * w));
    const sh = Math.max(1, Math.floor((maxY - minY) * h));
    try {
      const data = ctx.getImageData(sx, sy, sw, sh).data;
      const step = Math.max(1, Math.floor((sw * sh) / 400));
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4 * step) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        count++;
      }
      return count > 0 ? sum / count : null;
    } catch {
      return null;
    }
  };

  const analyzeFaceResults = (results: FaceLandmarkerResult) => {
    const faces = results.faceLandmarks ?? [];

    if (faces.length === 0) {
      return {
        isAllClear: false,
        message: "Position your face completely within the oval.",
        flashRed: false,
        yaw: 0,
        haveFace: false,
      };
    }

    if (faces.length > 1) {
      return {
        isAllClear: false,
        message: "Ensure you are the only person in the frame.",
        flashRed: false,
        yaw: 0,
        haveFace: true,
      };
    }

    const landmarks = faces[0];
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;
    for (const p of landmarks) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const faceWidth = maxX - minX;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (faceWidth < 0.2) {
      return {
        isAllClear: false,
        message: "Position your face completely within the oval.",
        flashRed: false,
        yaw: 0,
        haveFace: true,
      };
    }
    if (centerX < 0.25 || centerX > 0.75 || centerY < 0.2 || centerY > 0.85) {
      return {
        isAllClear: false,
        message: "Position your face completely within the oval.",
        flashRed: false,
        yaw: 0,
        haveFace: true,
      };
    }

    // Poor lighting
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const brightness = sampleBrightness(canvas, minX, minY, maxX, maxY);
        if (brightness !== null && brightness < 60) {
          return {
            isAllClear: false,
            message: "Move to a brighter, well-lit area.",
            flashRed: false,
            yaw: 0,
            haveFace: true,
          };
        }
      }
    }

    const blendshapes = results.faceBlendshapes?.[0]?.categories ?? [];
    const blinkLeft =
      blendshapes.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const blinkRight =
      blendshapes.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    if (blinkLeft > 0.75 && blinkRight > 0.75) {
      return {
        isAllClear: false,
        message: "Keep your eyes open and face visible.",
        flashRed: false,
        yaw: 0,
        haveFace: true,
      };
    }

    const matrixData =
      results.facialTransformationMatrixes?.[0]?.data ?? null;
    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    if (matrixData) {
      yaw = Math.asin(-matrixData[8]) * (180 / Math.PI);
      pitch = Math.atan2(matrixData[9], matrixData[10]) * (180 / Math.PI);
      roll = Math.atan2(matrixData[4], matrixData[0]) * (180 / Math.PI);
    }

    const jawOpen =
      blendshapes.find((c) => c.categoryName === "jawOpen")?.score ?? 0;

    if (Math.abs(pitch) > 15 || Math.abs(roll) > 15) {
      return {
        isAllClear: false,
        message:
          "Look directly at the camera with a neutral expression and mouth closed.",
        flashRed: false,
        yaw,
        haveFace: true,
      };
    }

    const liveness = livenessRef.current;
    if (!liveness.completed) {
      if (liveness.state === "waiting_right") {
        if (yaw < -20) liveness.state = "turned_right";
      } else if (liveness.state === "turned_right") {
        if (yaw > -5) liveness.state = "waiting_left";
      } else if (liveness.state === "waiting_left") {
        if (yaw > 20) {
          liveness.state = "done";
          liveness.completed = true;
        }
      }

      if (!liveness.completed) {
        if (jawOpen > 0.3) {
          return {
            isAllClear: false,
            message:
              "Look directly at the camera with a neutral expression and mouth closed.",
            flashRed: false,
            yaw,
            haveFace: true,
          };
        }
        const msg =
          liveness.state === "waiting_right" ||
          liveness.state === "turned_right"
            ? "Turn your head slowly to the right."
            : "Turn your head slowly to the left.";
        return {
          isAllClear: false,
          message: msg,
          flashRed: false,
          yaw,
          haveFace: true,
        };
      }
    }

    if (Math.abs(yaw) > 15) {
      return {
        isAllClear: false,
        message:
          "Look directly at the camera with a neutral expression and mouth closed.",
        flashRed: false,
        yaw,
        haveFace: true,
      };
    }

    if (jawOpen > 0.3) {
      return {
        isAllClear: false,
        message:
          "Look directly at the camera with a neutral expression and mouth closed.",
        flashRed: false,
        yaw,
        haveFace: true,
      };
    }

    return {
      isAllClear: true,
      message: ALL_CLEAR_MSG,
      flashRed: false,
      yaw,
      haveFace: true,
    };
  };

  const analyzeFaceForPositioning = (results: FaceLandmarkerResult) => {
    const faces = results.faceLandmarks ?? [];

    if (faces.length === 0) {
      return {
        isAllClear: false,
        message: "Position your face completely within the oval.",
        flashRed: false,
        yaw: 0,
        haveFace: false,
        qualityOk: false,
      };
    }

    if (faces.length > 1) {
      return {
        isAllClear: false,
        message: "Ensure you are the only person in the frame.",
        flashRed: false,
        yaw: 0,
        haveFace: true,
        qualityOk: false,
      };
    }

    const landmarks = faces[0];
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;
    for (const p of landmarks) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const faceWidth = maxX - minX;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (faceWidth < 0.2) {
      return {
        isAllClear: false,
        message: "Move closer until your face fills the oval.",
        flashRed: false,
        yaw: 0,
        haveFace: true,
        qualityOk: false,
      };
    }

    if (centerX < 0.25 || centerX > 0.75 || centerY < 0.2 || centerY > 0.85) {
      return {
        isAllClear: false,
        message: "Keep your face centered inside the oval.",
        flashRed: false,
        yaw: 0,
        haveFace: true,
        qualityOk: false,
      };
    }

    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const brightness = sampleBrightness(canvas, minX, minY, maxX, maxY);
        if (brightness !== null && brightness < 60) {
          return {
            isAllClear: false,
            message: "Move to a brighter, well-lit area.",
            flashRed: false,
            yaw: 0,
            haveFace: true,
            qualityOk: false,
          };
        }
      }
    }

    const blendshapes = results.faceBlendshapes?.[0]?.categories ?? [];
    const blinkLeft =
      blendshapes.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const blinkRight =
      blendshapes.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    const jawOpen =
      blendshapes.find((c) => c.categoryName === "jawOpen")?.score ?? 0;

    const matrixData =
      results.facialTransformationMatrixes?.[0]?.data ?? null;
    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    if (matrixData) {
      yaw = Math.asin(-matrixData[8]) * (180 / Math.PI);
      pitch = Math.atan2(matrixData[9], matrixData[10]) * (180 / Math.PI);
      roll = Math.atan2(matrixData[4], matrixData[0]) * (180 / Math.PI);
    }

    if (Math.abs(pitch) > 18 || Math.abs(roll) > 18) {
      return {
        isAllClear: false,
        message: "Keep your head level and inside the oval.",
        flashRed: false,
        yaw,
        haveFace: true,
        qualityOk: false,
      };
    }

    if (jawOpen > 0.35 || (blinkLeft > 0.75 && blinkRight > 0.75)) {
      return {
        isAllClear: false,
        message: "Keep your eyes open and mouth closed.",
        flashRed: false,
        yaw,
        haveFace: true,
        qualityOk: false,
      };
    }

    return {
      isAllClear: true,
      message: "Face quality is good.",
      flashRed: false,
      yaw,
      haveFace: true,
      qualityOk: true,
    };
  };

  const applyLivenessFeedback = (f: Feedback) => {
    setFeedback((prev) => {
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

    if (f.isAllClear && !timerIntervalRef.current && !completedRef.current) {
      startLivenessTimer();
    }
  };

  const positioningStableRef = useRef<{
    position: CapturePosition | null;
    since: number;
  }>({ position: null, since: 0 });

  const applyPositioningFeedback = (
    analysis: ReturnType<typeof analyzeFaceForPositioning>,
  ) => {
    const position = currentPositionRef.current;
    if (!position) return;

    if (!analysis.haveFace || !analysis.qualityOk) {
      positioningStableRef.current = { position: null, since: 0 };
      setProgress(0);
      setFeedback({
        isAllClear: false,
        message: analysis.message,
        flashRed: false,
      });
      return;
    }

    const yaw =
      smoothedYawRef.current === null
        ? analysis.yaw
        : smoothedYawRef.current * 0.65 + analysis.yaw * 0.35;
    smoothedYawRef.current = yaw;

    if (yawInRange(yaw, position)) {
      const stable = positioningStableRef.current;
      const now = Date.now();
      if (stable.position !== position) {
        positioningStableRef.current = { position, since: now };
      }
      const heldFor = now - positioningStableRef.current.since;
      setProgress(Math.min(100, (heldFor / POSITION_HOLD_MS) * 100));

      setFeedback({
        isAllClear: true,
        message: getPositionInstruction(position, yaw),
        flashRed: false,
      });

      if (
        heldFor >= POSITION_HOLD_MS &&
        capturePhaseRef.current === "positioning" &&
        !captureInProgressRef.current
      ) {
        positioningStableRef.current = { position: null, since: 0 };
        void runCaptureForPosition(position);
      }
    } else {
      positioningStableRef.current = { position: null, since: 0 };
      setProgress(0);
      setFeedback({
        isAllClear: false,
        message: getPositionInstruction(position, yaw),
        flashRed: false,
      });
    }
  };

  // ── Setup MediaPipe + camera ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 2,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        faceLandmarkerRef.current = landmarker;
        setModelLoaded(true);
      } catch (err) {
        console.error("[BiometricCaptureWidget] Model load failed", err);
        if (!cancelled) {
          setFeedback({
            isAllClear: false,
            message:
              "Failed to initialize face detection. Please reload the page.",
            flashRed: false,
          });
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setVideoReady(true);
        }
      } catch (err) {
        console.error("[BiometricCaptureWidget] Camera access failed", err);
        if (!cancelled) {
          setFeedback({
            isAllClear: false,
            message:
              "Camera access denied. Please allow camera access in your browser.",
            flashRed: false,
          });
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      clearTimer();
      clearCaptureTimer();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (transitionTimeoutRef.current)
        clearTimeout(transitionTimeoutRef.current);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const lm = faceLandmarkerRef.current;
      if (lm) {
        try {
          lm.close();
        } catch {
          // ignore
        }
        faceLandmarkerRef.current = null;
      }
    };
  }, []);

  // ── Detection loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!modelLoaded || !videoReady) return;
    if (completedRef.current) return;

    let stopped = false;
    let lastTs = -1;

    const loop = () => {
      if (stopped) return;
      const video = videoRef.current;
      const lm = faceLandmarkerRef.current;
      if (video && lm && video.readyState >= 2) {
        const ts = performance.now();
        if (ts !== lastTs) {
          lastTs = ts;
          try {
            const results = lm.detectForVideo(video, ts);
            const phase = capturePhaseRef.current;
            if (phase === "liveness") {
              const r = analyzeFaceResults(results);
              yawRef.current = r.yaw;
              applyLivenessFeedback({
                isAllClear: r.isAllClear,
                message: r.message,
                flashRed: r.flashRed,
              });
            } else if (phase === "positioning") {
              const r = analyzeFaceForPositioning(results);
              yawRef.current = r.yaw;
              applyPositioningFeedback(r);
            }
            // 'capturing' and 'saving' phases skip per-frame feedback — the
            // capture timer & async flow drive the UI instead.
          } catch (err) {
            console.error("[BiometricCaptureWidget] detectForVideo", err);
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelLoaded, videoReady, processing]);

  // ── Visuals ───────────────────────────────────────────────────────────────

  const frameBorderClass = (() => {
    if (feedback.flashRed) return "border-red-500";
    if (feedback.isAllClear || progress > 0)
      return "border-green-500 border-solid";
    return "border-gray-400 border-dashed";
  })();

  const frameGlow =
    feedback.isAllClear && !feedback.flashRed
      ? { boxShadow: "0 0 24px rgba(34, 197, 94, 0.5)" }
      : undefined;

  const arcRadius = 50;
  const arcCirc = 2 * Math.PI * arcRadius;
  const arcDashOffset = arcCirc - (progress / 100) * arcCirc;

  const initializing = !modelLoaded || !videoReady;
  const displayMessage = initializing
    ? "Initializing camera..."
    : feedback.message;

  return (
    <div className="space-y-5">
      {/* Stage indicator */}
      <div className="flex items-center justify-center gap-3">
        <StageStep
          label="Face Capture"
          state={faceComplete ? "complete" : "active"}
        />
        {capturePhase !== "liveness" && capturePhase !== "done" && (
          <span className="text-xs text-gray-500">
            {capturedPositions.length}/{CAPTURE_SEQUENCE.length} positions
          </span>
        )}
      </div>

      {/* Frame */}
      <div className="flex flex-col items-center">
        <div
          className={`relative overflow-hidden border-4 ${frameBorderClass} transition-colors duration-200 bg-black`}
          style={{
            width: 280,
            height: 360,
            borderRadius: "50%",
            ...frameGlow,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {initializing && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
              Initializing camera...
            </div>
          )}
        </div>

        {/* Stability / capture timer arc */}
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
          feedback.isAllClear && !initializing
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-amber-50 text-amber-800 border border-amber-200"
        }`}
      >
        <span className="text-base">
          {feedback.isAllClear && !initializing ? "✓" : "⚠"}
        </span>
        <span>{displayMessage}</span>
      </div>
    </div>
  );
};

// ─── Stage step pill ────────────────────────────────────────────────────────

const StageStep = ({
  label,
  state,
}: {
  label: string;
  state: "active" | "complete" | "pending";
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
      <span className="text-base">{state === "complete" ? "✓" : "😊"}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
};

export default BiometricCaptureWidget;
