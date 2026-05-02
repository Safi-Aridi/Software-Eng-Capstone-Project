We are continuing development on the National Passport Issuance System (NPIS) frontend.

Tech stack: React, TypeScript, Vite, Tailwind CSS. All data mocked via localStorage.

Before writing any code, read:

- src/pages/NewPassportApplicationPage.tsx (find the biometric placeholder at Step 4)
- src/services/applicationService.ts
- src/utils/seedTestData.ts
- App.tsx

---

## PHASE 8 — Live Biometric Capture UI

### SRS Requirements: FR-07, FR-07.1, FR-07.2, Table 4

### Context

In NewPassportApplicationPage.tsx, Step 4 currently has a comment:
`// TODO: Replace with real biometric capture component (FR-07)`
Replace that placeholder with the full BiometricCaptureWidget component built below.
This only appears for applicationType === 'NEW'. Renewal applications skip biometrics entirely — do not change that logic.

---

### FILE TO CREATE: `src/components/BiometricCaptureWidget.tsx`

This is a self-contained multi-stage biometric capture UI. It does NOT use a real camera or real ML — it fully simulates the guided capture experience as specified in the SRS.

#### Props interface:

```typescript
interface BiometricCaptureWidgetProps {
  onCaptureComplete: (result: {
    faceCaptured: boolean;
    fingerprintsCaptured: boolean;
  }) => void;
}
```

#### The widget has two sequential stages: FACE then FINGERPRINTS.

The parent (NewPassportApplicationPage) cannot advance to Step 5 until both stages are marked complete (onCaptureComplete is called with both true).

---

### STAGE 1 — FACE CAPTURE

**Layout:** A centered oval frame (CSS border-radius: 50% on a 280×360px div) with a dashed border, representing the camera viewfinder. Below it, an instruction text area. Below that, a status bar showing the 3-second stability timer.

**Simulated ML feedback loop:**
On mount of Stage 1, start a `setInterval` every 2500ms that randomly picks one of the following states and displays the corresponding instruction from SRS Table 4:

| Simulated condition   | On-screen instruction                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| Eyewear detected      | "Please remove your glasses."                                             |
| Face out of frame     | "Position your face completely within the oval."                          |
| Liveness — turn right | "Turn your head slowly to the right."                                     |
| Liveness — turn left  | "Turn your head slowly to the left."                                      |
| Pitch/yaw/roll error  | "Look directly at the camera with a neutral expression and mouth closed." |
| Poor lighting         | "Move to a brighter, well-lit area."                                      |
| Multiple faces        | "Ensure you are the only person in the frame."                            |
| **ALL CLEAR**         | "Perfect. Hold still for three seconds."                                  |

The ALL CLEAR state should occur with ~30% probability. When any other state fires, display the instruction in amber text with a warning icon. When ALL CLEAR fires, display in green text with a checkmark icon AND start the 3-second stability timer.

**3-second stability timer (FR-07.2):**

- Render as a circular progress arc (SVG) that fills over 3 seconds.
- Use `setInterval` at 100ms to increment progress (0→100%).
- If the ML feedback loop fires a non-ALL-CLEAR condition before the timer completes, reset the timer to 0 and display: "[specific error instruction] Timer reset. Please hold still."
- When the timer reaches 100%: show "Capture successful. Processing..." in green, pause 1 second, then advance to Stage 2.

**Visual state of the oval frame:**

- Default/error: dashed gray border
- ALL CLEAR / timer running: solid green border with a subtle green glow (box-shadow)
- Timer reset: border flashes red once then returns to gray

---

### STAGE 2 — FINGERPRINT CAPTURE

**Layout:** A rectangular frame (280×200px, dashed border) representing the hand viewfinder. Instruction text area below. Same 3-second stability timer arc as Stage 1.

**Fingerprint sequence (SRS Table 4):** The capture must follow this exact order:

1. "Show all 4 fingers of the RIGHT hand."
2. "Show all 4 fingers of the LEFT hand."
3. "Both THUMBS."

Each step goes through its own ML feedback simulation and 3-second timer before advancing to the next. So there are 3 sub-steps in Stage 2.

**Simulated ML feedback for fingerprints:**

| Condition           | Instruction                                                        |
| ------------------- | ------------------------------------------------------------------ |
| Incorrect sequence  | (display the current expected step from the sequence above)        |
| Motion blur         | "Hold your hand steady in front of the camera."                    |
| Poor focal distance | "Move your hand closer to the camera."                             |
| Low lighting        | "Environment too dark, move to a brighter area."                   |
| Background clutter  | "Please hold your hand against a plain, solid-colored background." |
| Fingers not joined  | "Keep your fingers pressed flat and close together."               |
| **ALL CLEAR**       | "Perfect. Hold still for three seconds."                           |

ALL CLEAR probability: ~35% per tick. Same timer reset logic as Stage 1.

After all 3 fingerprint sub-steps complete: show "Fingerprint capture successful. Processing..." pause 1 second, then call `onCaptureComplete({ faceCaptured: true, fingerprintsCaptured: true })`.

---

### STAGE PROGRESS INDICATOR

At the top of the widget, show a 2-step progress indicator:

- Step 1: Face Capture (icon: 😊 or a face SVG outline)
- Step 2: Fingerprint Capture (icon: fingerprint SVG outline)
  Active step is highlighted in blue, completed step in green with a checkmark, pending step in gray.

---

### INTEGRATION INTO NewPassportApplicationPage.tsx

In Step 4, replace the biometric TODO placeholder with:

```tsx
<BiometricCaptureWidget
  onCaptureComplete={(result) => {
    if (result.faceCaptured && result.fingerprintsCaptured) {
      setFormData((prev) => ({ ...prev, biometricCaptured: true }));
    }
  }}
/>
```

The "Next" button on Step 4 must remain disabled until `formData.biometricCaptured === true`.
Add a note below the widget: "Biometric data is encrypted and stored in compliance with ISO/IEC 19794-4 and ISO/IEC 19794-5."

---

## PHASE 9 — AI Assistant (NFR-USA-04)

### SRS Requirement: NFR-USA-04

"The system shall provide guided assistance through the AI assistant to help users complete application steps."
Response time: ≤ 3 seconds (NFR-PERF-06).

### Implementation: Floating Chat Widget using the Anthropic API

This widget is available on ALL citizen-facing pages. It is a floating button (bottom-right corner) that opens a chat panel. It uses the Anthropic API directly from the frontend (the API key handling is already configured in this environment).

---

### FILE TO CREATE: `src/components/AiAssistantWidget.tsx`

#### UI Structure:

- **Collapsed state**: A circular blue button, bottom-right corner (fixed position), with a chat bubble icon and label "Help". Has a subtle pulse animation to draw attention.
- **Expanded state**: A 380×520px chat panel that slides up from the button. Has a header "NPIS Assistant", a close (×) button, the message thread, an input field, and a send button.

#### System prompt to send with every API call:

You are a helpful assistant for the Lebanese National Passport Issuance System (NPIS).
Your job is to guide citizens through the passport application process.
You can help with:

Explaining what documents are required (Lebanese ID card or Civil Registry Extract issued within 3 months, passport photo with white background, old passport for renewals)
Explaining the application steps (identity verification → application form → biometric capture for new passports → payment via CashPlus → processing → delivery via LibanPost)
Explaining passport validity options (5 years: 200,000 LBP, 10 years: 350,000 LBP)
Explaining application statuses (Pending Review, Verified, Mukhtar Signed, Processed for Issuance, Delivered, Resubmission Required)
Explaining what Resubmission Required means and how to fix it
Explaining the payment process via CashPlus
Explaining delivery via LibanPost

Rules:

Keep responses concise (2-4 sentences max unless a list is genuinely helpful)
Never ask for personal data, passwords, or document contents
If asked about anything unrelated to the passport system, politely redirect: "I'm only able to help with passport application questions."
Always be polite and professional
Respond in the same language the user writes in (Arabic or English)

#### Behavior:

- Maintain conversation history in component state (array of `{ role: 'user' | 'assistant', content: string }`). Pass full history with each API call so the assistant has context.
- Show a typing indicator (three animated dots) while waiting for the API response.
- If the API call fails or times out after 5 seconds, show: "I'm having trouble connecting. Please try again in a moment."
- Limit conversation history to the last 10 messages to avoid token bloat.
- On first open (empty history), show 3 quick-reply suggestion buttons:
  - "What documents do I need?"
  - "How long does it take?"
  - "What does 'Resubmission Required' mean?"
    Clicking one sends it as a user message immediately.
- Messages from the assistant render with a small NPIS logo/icon on the left. User messages align right with a blue bubble.
- Input field: pressing Enter sends the message (same as clicking Send). Disable input and send button while a response is loading.

#### API call pattern:

```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: conversationHistory, // array of {role, content}
  }),
});
const data = await response.json();
const reply =
  data.content.find((b: any) => b.type === "text")?.text ??
  "Sorry, I couldn't generate a response.";
```

---

### INTEGRATION

In `App.tsx` (or a layout wrapper component), render `<AiAssistantWidget />` once, outside all routes, so it persists across navigation. It should appear on all `/citizen/*` routes but NOT on `/mukhtar/*` or `/officer/*` routes.

The cleanest way: create a `src/layouts/CitizenLayout.tsx` that wraps citizen routes with `<Outlet />` and renders `<AiAssistantWidget />` alongside it. Update App.tsx to use this layout for all citizen-facing routes.

---

## AFTER ALL CHANGES

Run `npm run build` and confirm zero TypeScript errors.

Verify:

1. In NewPassportApplicationPage Step 4 (NEW application only), the BiometricCaptureWidget renders and the feedback loop + timer simulation works correctly.
2. The Step 4 "Next" button is disabled until both face and fingerprint stages complete.
3. The AI assistant floating button appears on citizen pages, opens correctly, sends messages to the Anthropic API, and displays responses.
4. Quick-reply suggestions appear on first open and send correctly.
5. The assistant does NOT appear on /mukhtar/_ or /officer/_ routes.
