# Full Summary — National Passport Issuance System (NPIS)

## Overview

This document is a running record of all implementation work done on the NPIS frontend. The system handles citizen applications for Lebanese passports, including Identity Verification (formerly KYC), multi-step application creation, document upload, status tracking, and a backend-ready service architecture. The backend is not yet connected — all data is currently mocked using localStorage.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Supabase (backend — connection postponed)

---

## Session 1 — Authentication & Identity Verification

### Key Areas:

- Frontend authentication with mock login via localStorage
- Identity Verification (KYC) workflow
- Role-based routing (citizen / mukhtar / officer)
- Basic Citizen Dashboard with KYC status handling
- Test user seeding

### Files Created:

- `IdentityVerificationPage.tsx` — document upload and mock identity data extraction
- `IdentityVerificationPendingPanel.tsx` — pending status display
- `IdentityVerificationRejectedPanel.tsx` — rejection handling and resubmission option
- `CitizenDashboard.tsx` — displays KYC status and application list
- `AuthorizedLoginPage.tsx` — Mukhtar login (hidden behind small link)

### Files Modified:

- `authService.ts` — mock auth logic, localStorage scoping per user
- `CitizenSignupPage.tsx` — routes to identity verification after signup
- `CitizenLoginPage.tsx` — routes based on KYC status on login
- `App.tsx` — added `/identity-verification` route
- `KycSubmissionPanel.tsx`, `KycPendingPanel.tsx`, `KycRejectedPanel.tsx` — renamed to Identity Verification terminology

### Routes:

| Route                    | Component                    |
| ------------------------ | ---------------------------- |
| `/`                      | CitizenLoginPage             |
| `/signup`                | CitizenSignupPage            |
| `/authorized-login`      | AuthorizedLoginPage          |
| `/identity-verification` | IdentityVerificationPage     |
| `/citizen/dashboard`     | CitizenDashboard (protected) |
| `/mukhtar/dashboard`     | MukhtarDashboard (protected) |

### Citizen Flow:

1. Sign up with email/mobile + password
2. Redirected to Identity Verification page — upload document (QR/barcode/civil registry extract)
3. System mock-extracts: Full Name, Registry Number (readonly), Date of Birth
4. On submit → status set to `PENDING_IDENTITY_VERIFICATION` → redirected to dashboard
5. Dashboard shows correct state: Pending / Accepted / Rejected

### Issues Fixed:

- **Multiple login data bleed**: localStorage keys were shared across users. Fixed by scoping all KYC data to `kyc_status_<userId>` and `identity_data_<userId>`.
- **Re-prompting KYC on login**: After signup and KYC submission, login was re-routing to identity verification. Fixed by checking submission status before routing.

### Test Users (seeded in localStorage):

| User         | Email             | Password | KYC Status                    |
| ------------ | ----------------- | -------- | ----------------------------- |
| Ahmad Khalil | pending@test.com  | test123  | PENDING_IDENTITY_VERIFICATION |
| Sara Mansour | accepted@test.com | test123  | IDENTITY_VERIFIED             |
| Omar Fayyad  | rejected@test.com | test123  | IDENTITY_REJECTED             |

---

## Session 2 — localStorage Scoping Fix & Auth Hardening

### Key Areas:

- Fixed user-specific localStorage data scoping
- Established full frontend authentication system
- Supabase database connected to backend (connection later postponed)
- API service layer prepared for future integration

### Changes:

- All KYC/identity data keyed by `userId` — no shared keys remain
- On logout: clears session only, not other users' data
- `seedTestData.ts` created — seeds users only if not already present (safe on reload)
- All users stored under single `npis_users` key as array
- Supabase schema fixed and connection issues resolved
- Backend connection postponed until team stabilizes API

**Commit:** `feat: Establish authentication system and database connection`

---

## Session 3 — Passport Application Creation (Phase 1)

### SRS Requirements Covered:

- FR-06: Base application record generation
- FR-07: Live biometric capture placeholder (new applications)
- FR-08: Renewal request evaluation + old passport upload
- FR-08.1: Fee calculation based on validity duration

### Files Created:

- `src/services/applicationService.ts` — application CRUD against localStorage, tracking number generation, TODO markers for real API endpoints
- `src/pages/NewPassportApplicationPage.tsx` — 5-step multi-step application form

### Files Modified:

- `CitizenDashboard.tsx` — "Apply for Passport" button routes to `/application/new`; application cards with status badges
- `App.tsx` — added `/application/new` route (protected, citizen only)

### Routes Added:

| Route              | Component                              |
| ------------------ | -------------------------------------- |
| `/application/new` | NewPassportApplicationPage (protected) |

### Application Form — 5 Steps (later expanded to 6, see Session 7):

| Step                          | Content                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| 1 — Type Selection            | "New Passport" or "Passport Renewal" option cards                            |
| 2 — Passport Details          | Validity (5yr / 10yr), calculated fee (200,000 / 350,000 LBP)                |
| 3 — Document Upload           | Identity doc + passport photo (both flows); old passport scan (renewal only) |
| 4 — Mukhtar Form & Biometrics | Address, District, Mukhtar name; mock biometric capture (new only)           |
| 5 — Review & Submit           | Read-only summary, submit saves to localStorage, redirects to dashboard      |

### Key Implementation Details:

- Single-page component with internal step state — no separate routes per step
- Renewal flow blocks Next at Step 3 if old passport is missing (FR-08 exception)
- Biometric step marked with `// TODO: Replace with real biometric capture component (FR-07)`
- Application stored as `PassportApplication` with status `PENDING_REVIEW` and formatted tracking number `NPIS-2026-XXXXXX`
- Dashboard shows application cards: tracking number, type, submission date, color-coded status badge

### PassportApplication Interface:

```typescript
interface PassportApplication {
  applicationId: string;
  userId: string;
  applicationType: "NEW" | "RENEWAL";
  currentStatus:
    | "PENDING_REVIEW"
    | "VERIFIED"
    | "MUKHTAR_SIGNED"
    | "PROCESSED"
    | "RESUBMISSION_REQUIRED"
    | "DELIVERED";
  submissionDate: string;
  trackingNumber: string; // NPIS-2026-XXXXXX
  passportValidity: 5 | 10;
  feeAmount: number;
  paymentStatus: "UNPAID" | "Paid" | "Failed";
  documents: {
    identityDocument: string | null;
    passportPhoto: string | null;
    oldPassport: string | null;
  };
  mukhtarFormData: {
    address: string;
    district: string;
    mukhtarName: string;
  };
  biometricCaptured: boolean;
}
```

---

## Session 3 (cont.) — Status Tracking & Document Enhancements (Phase 3)

### SRS Requirements Covered:

- FR-10: Application status display
- FR-11: Estimated completion time display (mocked)
- FR-22: Resubmission status handling
- FR-23: Resubmission notification (frontend simulation)
- NFR-USA-02: Clear validation messages on invalid inputs

### Files Created:

- `src/pages/ApplicationStatusPage.tsx` — full status timeline page per application
- `src/pages/DocumentResubmissionPage.tsx` — resubmission form for RESUBMISSION_REQUIRED applications

### Files Modified:

- `NewPassportApplicationPage.tsx` — enhanced document upload with drag-and-drop, progress simulation, image thumbnail preview, PDF icon for PDF files
- `CitizenDashboard.tsx` — "Track Application" button per card; yellow warning banner for RESUBMISSION_REQUIRED applications
- `App.tsx` — added status and resubmission routes

### Routes Added:

| Route                                  | Component                            |
| -------------------------------------- | ------------------------------------ |
| `/application/status/:applicationId`   | ApplicationStatusPage (protected)    |
| `/application/resubmit/:applicationId` | DocumentResubmissionPage (protected) |

### Status Timeline Stages (in order):

1. Application Submitted
2. Documents Under Review
3. Verified by System
4. Mukhtar Signed
5. Processed for Issuance
6. Delivered

- Completed stages: green filled circle
- Current stage: blue pulsing circle
- Pending stages: gray dashed
- `RESUBMISSION_REQUIRED`: red highlight on "Documents Under Review" + action banner

### Estimated Completion Mock Logic (FR-11):

| Status                | Estimate Shown                  |
| --------------------- | ------------------------------- |
| PENDING_REVIEW        | 5–7 business days               |
| VERIFIED              | 3–5 business days               |
| MUKHTAR_SIGNED        | 2–3 business days               |
| PROCESSED             | 1–2 business days               |
| DELIVERED             | Completed                       |
| RESUBMISSION_REQUIRED | On hold — awaiting resubmission |

### Additional Test Applications Seeded:

| User                    | App   | Type    | Status                | Tracking         |
| ----------------------- | ----- | ------- | --------------------- | ---------------- |
| Sara Mansour (user_002) | App 1 | NEW     | MUKHTAR_SIGNED        | NPIS-2026-000001 |
| Sara Mansour (user_002) | App 2 | RENEWAL | PENDING_REVIEW        | NPIS-2026-000002 |
| Ahmad Khalil (user_001) | App 1 | NEW     | RESUBMISSION_REQUIRED | NPIS-2026-000003 |

---

## Session 3 (cont.) — API Service Layer (Phase 4)

### Purpose:

Decouple all components from direct localStorage access. All data access now goes through typed service classes with TODO markers at every point where a real API call will replace the mock.

### Files Created:

- `src/services/apiClient.ts` — base API client (URL config, auth headers, error handling, not yet active)
- `src/services/notificationService.ts` — FR-23, FR-32 notifications stored in `notifications_<userId>`
- `src/services/paymentService.ts` — FR-09, FR-28/29/30 payment records, simulated CashPlus callback
- `src/services/mukhtarService.ts` — FR-13, FR-15, FR-16 pending queue and mock e-signature
- `src/services/officerService.ts` — FR-18, FR-19 final approval and old passport cancellation
- `src/services/index.ts` — barrel export for all services

### Files Modified:

- `src/services/authService.ts` — refactored to typed async functions with TODO comments
- `src/services/applicationService.ts` — refactored to typed async functions with TODO comments
- `CitizenDashboard.tsx`, `ApplicationStatusPage.tsx`, `DocumentResubmissionPage.tsx`, `NewPassportApplicationPage.tsx` — all direct localStorage calls replaced with service function calls

### Service Architecture:

| Service             | SRS Coverage               | Future Endpoint                            |
| ------------------- | -------------------------- | ------------------------------------------ |
| authService         | FR-03, FR-04, FR-05        | POST /api/auth/login, /register            |
| applicationService  | FR-06, FR-08, FR-10, FR-11 | GET/POST /api/applications                 |
| notificationService | FR-23, FR-32               | GET /api/notifications                     |
| paymentService      | FR-09, FR-28, FR-29, FR-30 | POST /api/payments/initiate                |
| mukhtarService      | FR-13, FR-15, FR-16        | GET/POST /api/mukhtar/applications         |
| officerService      | FR-18, FR-19               | POST /api/officer/applications/:id/approve |

**Commit:** `feat: Implement passport application workflow and service architecture`

---

## Session 4 — Mukhtar & GS Officer Dashboards (Phase 5 & 6)

### SRS Requirements Covered:

- FR-12 to FR-16: Mukhtar authentication, pending queue, citizen data display, e-signature, status update
- FR-17 to FR-19: GS Officer authentication, final approval, old passport cancellation

### Files Created:

- `src/pages/MukhtarDashboard.tsx` — pending application queue, detail drawer, approve & sign, request resubmission
- `src/pages/OfficerDashboard.tsx` — MUKHTAR_SIGNED queue, final approval, old passport cancellation for renewals

### Files Modified:

- `src/services/mukhtarService.ts` — extended with `signApplication()`, `requestResubmission()` mock functions
- `src/services/officerService.ts` — extended with `approveApplication()`, `cancelOldPassport()` mock functions
- `AuthorizedLoginPage.tsx` — updated to route `mukhtar` role → `/mukhtar/dashboard`, `officer` role → `/officer/dashboard`
- `App.tsx` — added protected routes for both dashboards
- `src/utils/seedTestData.ts` — seeded Mukhtar and Officer test users; seeded VERIFIED and MUKHTAR_SIGNED test applications

### Routes Added:

| Route                | Component                                   |
| -------------------- | ------------------------------------------- |
| `/mukhtar/dashboard` | MukhtarDashboard (protected, role: mukhtar) |
| `/officer/dashboard` | OfficerDashboard (protected, role: officer) |

### Mukhtar Dashboard Features:

- Loads applications with `currentStatus === 'VERIFIED'` from localStorage
- Each card shows: tracking number, applicant name, type, submission date, district
- Detail drawer: full citizen data, document thumbnails, application summary
- "Approve & Sign" button with confirmation modal — 5% random signature failure simulation
- On success: status → `MUKHTAR_SIGNED`, mock signature stored as `mukhtar_signature_<applicationId>`
- "Request Resubmission" button → status → `RESUBMISSION_REQUIRED`
- Success/error toast notifications, auto-dismiss after 3 seconds

### GS Officer Dashboard Features:

- Loads applications with `currentStatus === 'MUKHTAR_SIGNED'`
- Detail panel shows full application data + Mukhtar signature timestamp
- "Final Approval" button → status → `PROCESSED`
- For RENEWAL applications: secondary confirmation modal for old passport cancellation → stored as `cancelled_passport_<applicationId>`
- NEW applications skip cancellation step entirely

### Test Users Added:

| User         | Email            | Password | Role    |
| ------------ | ---------------- | -------- | ------- |
| Khalil Raad  | mukhtar@test.com | test123  | mukhtar |
| Rima Sleiman | officer@test.com | test123  | officer |

### Test Applications Added:

| User         | Type    | Status         | Tracking         |
| ------------ | ------- | -------------- | ---------------- |
| Sara Mansour | NEW     | VERIFIED       | NPIS-2026-000004 |
| Sara Mansour | NEW     | VERIFIED       | NPIS-2026-000005 |
| Sara Mansour | RENEWAL | VERIFIED       | NPIS-2026-000006 |
| Sara Mansour | NEW     | MUKHTAR_SIGNED | NPIS-2026-000007 |
| Sara Mansour | RENEWAL | MUKHTAR_SIGNED | NPIS-2026-000008 |

### Known Issue:

- Mukhtar dashboard UI exists but functionality needs verification — the queue, detail drawer, and signing flow require end-to-end testing to confirm all state transitions work correctly.

---

## Session 5 — Payment Flow UI (Phase 7)

### SRS Requirements Covered:

- FR-08.1: Fee calculation before payment transmission
- FR-09: Application fee transmission to CashPlus gateway
- FR-28: Payment success callback processing
- FR-29: Payment failure callback processing
- FR-30: Payment timeout handling (15-minute rule)

### Files Created:

- `src/pages/PaymentPage.tsx` — dedicated payment screen at `/application/pay/:applicationId`

### Files Modified:

- `src/services/paymentService.ts` — added `initiatePayment()`, `getPaymentStatus()`, `checkExpiredPayments()` with TODO markers
- `src/services/applicationService.ts` — added `paymentStatus: 'UNPAID' | 'Paid' | 'Failed'` field to PassportApplication interface
- `NewPassportApplicationPage.tsx` — Step 6 (Review) now redirects to `/application/pay/:applicationId` instead of dashboard; fee acknowledgment shown clearly
- `CitizenDashboard.tsx` — added UNPAID (yellow) and Failed (red) payment banners on application cards; calls `checkExpiredPayments()` on mount for FR-30
- `App.tsx` — added `/application/pay/:applicationId` protected route

### Routes Added:

| Route                             | Component                             |
| --------------------------------- | ------------------------------------- |
| `/application/pay/:applicationId` | PaymentPage (protected, citizen only) |

### Payment Flow:

1. Citizen submits application → saved with `paymentStatus: 'UNPAID'` → redirected to PaymentPage
2. PaymentPage shows: tracking number, type, validity, fee amount prominently, CashPlus branding placeholder
3. "Pay Now" triggers 2-second loading state ("Connecting to CashPlus gateway...")
4. Weighted random outcome simulation:
   - 75% SUCCESS → `paymentStatus: 'Paid'` → green confirmation → 3-second countdown → redirect to dashboard
   - 15% FAILED → `paymentStatus: 'Failed'` → red panel → "Retry Payment" option → failure notification created
   - 10% GATEWAY UNAVAILABLE → no state change → amber panel → "Return to Dashboard"
5. Back-navigation guard using React Router `useBlocker` (no `window.unload` events)
6. FR-30: On dashboard load, applications with `paymentStatus: 'UNPAID'` older than 15 minutes are auto-failed

### Payment Record Structure (localStorage key: `payment_<applicationId>`):

```typescript
{
  applicationId: string,
  userId: string,
  amount: number,
  status: 'UNPAID' | 'Paid' | 'Failed',
  initiatedAt: string | null,
  resolvedAt: string | null,
  gatewayRef: string | null   // 'CASHPLUS-MOCK-<8 digits>' on success
}
```

### Test Application Added:

| User         | Type | Status         | Payment | Tracking         | Note                                                             |
| ------------ | ---- | -------------- | ------- | ---------------- | ---------------------------------------------------------------- |
| Sara Mansour | NEW  | PENDING_REVIEW | UNPAID  | NPIS-2026-000009 | Submitted 20min ago — triggers FR-30 auto-fail on dashboard load |

---

## Session 6 — Routing Bug Fixes

### Problems Fixed:

- **White screen on page reload**: Vite dev server was not configured to fall back to `index.html` for client-side routes. Fixed by adding `historyApiFallback: true` to `vite.config.ts` and creating `public/_redirects` for deployment.
- **Back button not re-rendering page**: Diagnosed and fixed duplicate Router mounting or stale navigation state issue in `App.tsx` / `main.tsx`.
- **`unload` Permissions Policy violation**: Removed all `window.addEventListener('beforeunload'/'unload', ...)` calls. Replaced PaymentPage back-navigation guard with React Router's `useBlocker` hook — in-page confirmation modal instead of browser dialog.

### Files Modified:

- `vite.config.ts` — added `server: { historyApiFallback: true }`
- `public/_redirects` — created with `/* /index.html 200` for deployment
- `App.tsx` / `main.tsx` — ensured single Router instance
- `PaymentPage.tsx` — replaced `beforeunload` with `useBlocker`, added in-page "Leave?" confirmation modal

---

## Session 7 — OTP UI, Dev Status Panel, Biometric Fix (Phase 8 & 9)

### SRS Requirements Covered:

- FR-02: Mobile number OTP validation UI
- FR-07, FR-07.1, FR-07.2: Live biometric capture with manual trigger and stability timer
- NFR-USA-04: AI assistant guidance

### Files Created:

- `src/components/BiometricCaptureWidget.tsx` — full guided biometric capture simulation (face + fingerprints)
- `src/components/AiAssistantWidget.tsx` — floating chat widget powered by Anthropic API
- `src/components/DevStatusPanel.tsx` — developer tool for overriding application status (dev mode only)
- `src/layouts/CitizenLayout.tsx` — layout wrapper rendering AI assistant on all citizen routes

### Files Modified:

- `CitizenSignupPage.tsx` — added 2-step OTP flow (registration form → 6-box OTP input with countdown timer)
- `authService.ts` — added `generateOtp()` and `validateOtp()` with localStorage mock and console.log for dev testing
- `NewPassportApplicationPage.tsx` — expanded from 5 to 6 steps; split Mukhtar details (Step 4) and Biometric Capture (Step 5, NEW only) into separate steps; Step 6 is Review & Submit
- `App.tsx` — added DevStatusPanel (dev mode only); wrapped citizen routes in CitizenLayout

### OTP Flow (FR-02):

- Step 1: Registration form → "Send OTP" button → calls `authService.generateOtp(mobile)` → OTP logged to console in dev
- Step 2: 6 individual digit input boxes (auto-advance, auto-submit on fill) + 5-minute countdown timer
- Resend Code link: disabled until timer expires, then re-enables
- Error states: INVALID ("X attempts remaining"), EXPIRED (resend immediately), LOCKED ("Too many attempts — Start Over")
- OTP stored as `otp_<mobile>: { code, expiresAt, attempts }` in localStorage
- TODO: Replace with POST /api/otp/send and POST /api/otp/validate

### Biometric Capture Widget (FR-07, FR-07.1, FR-07.2):

- Stage 1 — Face Capture:
  - Idle on mount — oval frame shown, "Start Face Capture" button required to begin
  - ML feedback loop starts only after button click (setInterval every 2500ms)
  - ALL CLEAR (~30% probability) → starts 3-second SVG arc timer
  - Any error before timer completes → timer resets, error instruction displayed
  - Capture success → advances to Stage 2
- Stage 2 — Fingerprint Capture (3 sub-steps):
  - Idle on mount — "Start Fingerprint Capture" button required to begin
  - Sub-step sequence: Right hand → Left hand → Thumbs
  - Manual "Continue" button between each sub-step
  - Same ML feedback loop + 3-second timer per sub-step
  - All 3 complete → calls `onCaptureComplete({ faceCaptured: true, fingerprintsCaptured: true })`
- Step 5 "Next" button disabled until biometricCaptured === true
- Compliance note displayed: ISO/IEC 19794-4 and ISO/IEC 19794-5

### Application Form — Final 6-Step Structure:

| Step                  | Content                                    | Shown For                         |
| --------------------- | ------------------------------------------ | --------------------------------- |
| 1 — Type Selection    | New Passport / Passport Renewal            | Both                              |
| 2 — Passport Details  | Validity, fee calculation                  | Both                              |
| 3 — Document Upload   | Identity doc, passport photo, old passport | Both (old passport: renewal only) |
| 4 — Mukhtar Details   | Address, district, mukhtar name            | Both                              |
| 5 — Biometric Capture | Face + fingerprint simulation              | NEW only                          |
| 6 — Review & Submit   | Read-only summary, fee acknowledgment      | Both                              |

### AI Assistant Widget (NFR-USA-04):

- Floating button fixed bottom-right on all citizen pages (not on mukhtar/officer routes)
- Powered by Anthropic API (`claude-sonnet-4-20250514`)
- System prompt scoped to NPIS passport guidance only
- Features: conversation history (last 10 messages), typing indicator, 3 quick-reply suggestions on first open, bilingual (Arabic/English), 5-second timeout with fallback message
- TODO: Consider moving API call server-side to protect key before production

### Dev Status Panel (Development Bridge for FR-20–FR-27):

- Visible only when `import.meta.env.DEV === true` — never ships to production
- Position: fixed bottom-left
- Features: application selector dropdown, status override buttons (PENDING_REVIEW / VERIFIED / MUKHTAR_SIGNED / PROCESSED / RESUBMISSION_REQUIRED / DELIVERED), payment status override (UNPAID / Paid / Failed), "Reload Dashboard", "Clear All Applications", "Re-seed Test Data"
- Purpose: bridges the absent ML verification pipeline so Mukhtar and GS Officer queues can be populated during development

---

## Session 8 — Citizen Portal Completion (Priority 1)

### SRS Requirements Covered:

- FR-05.1: Account lockout countdown UI
- FR-09: Fee acknowledgment checkbox
- FR-22: Resubmission guidance with per-document rejection reasons
- FR-23, FR-32: Notification Center UI
- NFR-USA-02, NFR-USA-03: Usability improvements

### Files Created:

- `src/pages/PreApplicationChecklistPage.tsx` — pre-application document checklist
- `src/pages/CitizenProfilePage.tsx` — citizen profile view and edit

### Files Modified:

- `CitizenDashboard.tsx` — notification bell with badge, profile link, application filter/sort toolbar, "Apply" routes to checklist
- `CitizenLoginPage.tsx` — account lockout countdown panel
- `authService.ts` — lockAccount, isAccountLocked, getRemainingLockTime
- `notificationService.ts` — markAsRead, markAllAsRead, getUnreadCount
- `DocumentResubmissionPage.tsx` — rejection reasons, acceptance criteria, accepted-field indicators
- `applicationService.ts` — added resubmissionReasons field to PassportApplication interface
- `NewPassportApplicationPage.tsx` — fee acknowledgment checkbox on Step 6
- `DevStatusPanel.tsx` — seeds mock resubmissionReasons when setting RESUBMISSION_REQUIRED
- `App.tsx` — added /application/checklist and /citizen/profile routes

### Routes Added:

| Route                    | Component                                        |
| ------------------------ | ------------------------------------------------ |
| `/application/checklist` | PreApplicationChecklistPage (protected, citizen) |
| `/citizen/profile`       | CitizenProfilePage (protected, citizen)          |

### Citizen Portal Features Completed:

- Notification bell added to the Citizen Dashboard header with unread badge support
- Notification Center UI added with read/unread state handling
- Profile link added from the dashboard to the citizen profile page
- Citizen profile page added for viewing and editing citizen contact/profile information
- Application dashboard improved with status filtering and date sorting
- "Apply" action now routes through the pre-application checklist before the application form
- Login lockout state now displays a countdown panel showing when the citizen can retry
- Document resubmission page now shows per-document rejection reasons and acceptance criteria
- Accepted documents are visually indicated so the citizen knows which fields do not need correction
- Step 6 of the application form now requires explicit fee acknowledgment before submission
- Dev Status Panel now seeds mock rejection reasons when setting an application to `RESUBMISSION_REQUIRED`

## Current Application Status Summary

### What's Complete:

- ✅ Citizen signup with OTP mobile validation UI (mock SMS)
- ✅ Citizen login and logout
- ✅ Account lockout countdown UI
- ✅ Identity verification (KYC) flow — pending, accepted, rejected, resubmission
- ✅ Role-based routing and protected routes
- ✅ Citizen profile page — view and edit profile/contact information
- ✅ Pre-application document checklist before starting application
- ✅ Multi-step passport application form — 6 steps (NEW) / 5 steps (RENEWAL)
- ✅ Fee acknowledgment checkbox on Step 6
- ✅ Document upload with drag-and-drop, preview, validation
- ✅ Biometric capture UI — manual trigger, ML feedback simulation, 3-second stability timer, face + fingerprints
- ✅ Payment flow — dedicated PaymentPage, CashPlus simulation (success/fail/unavailable), FR-30 timeout auto-fail
- ✅ Application status timeline with estimated completion
- ✅ Document resubmission flow with per-document rejection reasons and acceptance criteria
- ✅ Notification banners for action-required applications (resubmission, payment)
- ✅ Notification Center UI — bell badge, read/unread state, mark as read, mark all as read
- ✅ Application filtering/sorting on CitizenDashboard
- ✅ Mukhtar Dashboard — pending queue, detail drawer, e-signature, resubmission trigger
- ✅ GS Officer Dashboard — approval queue, final approval, old passport cancellation
- ✅ AI assistant floating chat widget (Anthropic API)
- ✅ Developer status override panel (dev mode only)
- ✅ Full API service layer with mock implementations and TODO markers
- ✅ Test data seeding for all user/application/payment states
- ✅ Routing fixed — reload, back button, no unload violations
- ✅ Priority 1 Citizen Portal Completion is done

### What's Not Yet Built:

- ⬜ Mukhtar Dashboard end-to-end verification/fix — queue loading, detail drawer, signing, and resubmission flow need full testing after citizen-side completion
- ⬜ Application receipt download — no printable/downloadable confirmation after submission and payment (UX)
- ⬜ Passport expiry reminder — no banner on dashboard when delivered passport nears expiry (UX)
- ⬜ ML document verification pipeline — automated status transitions FR-20 to FR-27 (deferred; Dev Panel bridges gap)
- ⬜ LibanPost delivery integration — FR-31 to FR-33 (deferred)
- ⬜ Real backend integration — replace all localStorage mocks with API calls through `apiClient.ts`, connect Supabase auth and database, wire ML pipeline
- ⬜ OTP SMS gateway — UI complete, real SMS transmission not connected (FR-02 backend)
- ⬜ Real CashPlus gateway — UI complete, real payment not connected (FR-09 backend)
- ⬜ Real biometric ML — UI complete, FaceNet/U-Net inference not connected (FR-07 backend)

---

## Next Steps (Priority Order)

### 1. Mukhtar Dashboard Fix & Verification — High Priority

Priority 1 Citizen Portal Completion is now done. The next priority is to verify and fix the Mukhtar dashboard end-to-end:

- Confirm login flow works end-to-end (mukhtar@test.com / test123 → `/mukhtar/dashboard`)
- Verify VERIFIED applications appear in the queue
- Test approve & sign flow → status transitions to MUKHTAR_SIGNED
- Test resubmission trigger → status transitions to RESUBMISSION_REQUIRED with seeded rejection reasons
- Confirm citizen receives/reads the generated notification after Mukhtar action
- Use Dev Status Panel to seed VERIFIED and RESUBMISSION_REQUIRED applications for testing

### 2. Remaining Citizen UX Enhancements — Medium Priority

- **Application Receipt Download**: generate and offer a downloadable PDF receipt after successful submission and payment (UX)
- **Passport Expiry Reminder**: banner on dashboard cards with status DELIVERED when expiry is within 6 months (UX)

### 3. Real Backend Integration — When Team API Stabilizes

- Replace all TODO-marked service functions with real API calls through `apiClient.ts`
- Connect Supabase auth and database
- Wire real SMS OTP gateway (FR-02)
- Wire real CashPlus payment gateway (FR-09, FR-28–FR-30)
- Wire ML document verification pipeline (FR-20–FR-27)
- Wire real biometric ML inference (FR-07)
- Wire LibanPost delivery integration (FR-31–FR-33)

### 4. ML Document Verification (Deferred)

- Automated status transitions: PENDING_REVIEW → VERIFIED or RESUBMISSION_REQUIRED (FR-20–FR-22)
- Mukhtar routing by jurisdiction (FR-24)
- Post-signature integrity check (FR-25–FR-26)
- Branch processing speed calculation (FR-27)

### 5. LibanPost Delivery Integration (Deferred)

- Delivery manifest transmission on PROCESSED status (FR-31)
- Citizen delivery notification (FR-32)
- Delivery/swap closure callback → DELIVERED or Delivery Failed (FR-33)

---

## ⚠️ IMPORTANT — Backend Integration Notes (NestJS)

These are gotchas to address when wiring the frontend to the NestJS backend. The current frontend is architecturally sound (service layer with TODO markers, components decoupled from localStorage), but the following gaps will cause issues if not handled during integration. Read this section before starting backend integration.

### 1. Simulated Backend Side-Effects Are Missing

The mock service functions update state but do not simulate the side-effects that the NestJS backend will perform automatically. The most visible example: when an application status changes (e.g., Mukhtar signs an application), the real backend will create a notification record in the same transaction. Currently, the frontend mock changes the status but does **not** create a notification, so the Notification Center looks broken end-to-end even though the wiring is correct.

**Action during integration:**

- Identify all places in mock services where a status change should trigger a backend side-effect (notification creation, audit log entry, payment record update, etc.).
- During mock development, optionally add simulated side-effect calls (e.g., `notificationService.create(...)` after `applicationService.updateStatus(...)`) to make the UI demonstrable.
- When connecting to NestJS, **remove** these simulated side-effect calls — the backend handles them via NestJS service layer, event emitters, or database triggers. Mark such calls with `// TODO: Remove when backend is connected — NestJS handles this server-side`.

### 2. Async/Sync Consistency

All service functions are already declared `async` and return Promises, but localStorage operations are synchronous under the hood. When connected to NestJS via HTTP, the real latency will surface. Audit every service caller to confirm `await` is used. Any synchronous-style call (`const apps = applicationService.getAll()` without `await`) will break and return a Promise object instead of data.

### 3. Data Shape Drift Between Frontend and NestJS DTOs

The frontend currently uses TypeScript interfaces like `PassportApplication` with fields like `applicationId`, `currentStatus`, `submissionDate`. NestJS will likely return DTOs with different shapes — possibly snake_case fields, numeric IDs instead of strings, different enum casing, ISO timestamps in different formats, nested relations rather than flat objects.

**Action during integration:**

- Once the NestJS team provides the OpenAPI/Swagger spec, create a `src/types/api.ts` file with interfaces matching the NestJS DTOs exactly.
- Build adapter functions inside each service (e.g., `mapApiApplicationToFrontend(dto)`) that translate between the API response shape and the existing frontend `PassportApplication` interface.
- Components stay untouched — only the service internals change.

### 4. localStorage-Only Keys With No Backend Equivalent

Several localStorage keys exist purely as frontend mock plumbing and will not exist server-side:

- `mukhtar_signature_<applicationId>` — backend stores signatures via a proper Signature entity tied to the Application
- `cancelled_passport_<applicationId>` — backend will use the `Old Passport Cancellation` entity defined in SRS section 3.1
- `payment_<applicationId>` — backend has a dedicated `Payment` table
- `otp_<mobile>` — OTP is server-side only; frontend never sees the code, only sends/validates via API
- `kyc_status_<userId>`, `identity_data_<userId>` — backend stores these on the User/CitizenProfile entity

**Action during integration:** Grep for all localStorage keys outside `src/services/`. Any direct access in a component is a bug — it must go through a service function so the backend swap is transparent.

### 5. Authentication Token Handling

The current "session" is just a userId in localStorage. NestJS will use JWT (likely with `@nestjs/jwt` and Passport strategy). The login response will return an `access_token` (and possibly a `refresh_token`).

**Action during integration:**

- Confirm `apiClient.ts` has interceptor logic to attach `Authorization: Bearer <token>` to every request.
- Store the JWT in localStorage (or sessionStorage) under a clear key like `npis_access_token`.
- Handle 401 responses globally — clear the token and redirect to `/`.
- If NestJS uses refresh tokens, implement the refresh flow in `apiClient.ts` interceptors.
- Consider role-based guards on the backend (`@Roles('mukhtar')` decorators on NestJS controllers) — the frontend `ProtectedRoute` component will still work, but the backend is the actual security boundary.

### 6. File Uploads — Significant Interface Change

Documents are currently stored as base64 strings in localStorage. The real flow with NestJS will be:

1. Frontend uploads file via `multipart/form-data` to a NestJS endpoint (likely using `@nestjs/platform-express` with `FileInterceptor` and Multer).
2. NestJS stores the file (local disk, S3, or similar) and returns a URL or storage key.
3. Frontend submits the application with the URL/key, not the file content.

**Action during integration:**

- `applicationService.create()` will change from "store the entire file in the application object" to "upload files first, get URLs, then submit application with URLs."
- Document upload progress, retry logic, and file size limits become real concerns (currently mocked).
- The `documents` field on `PassportApplication` will hold URLs instead of base64 strings — components like the document preview will need to handle URLs (e.g., `<img src={app.documents.passportPhoto} />` works for both, so this is mostly transparent).

### 7. Real-Time Notifications

The notification center currently refreshes only when the user opens it or reloads the page. For production-grade UX where status changes appear live (e.g., a Mukhtar signs and the citizen sees the notification within seconds), consider:

- **Polling** — simplest, frontend calls `notificationService.getUnread()` every 30–60 seconds. NestJS handles this fine without extra infrastructure.
- **WebSockets** — NestJS has first-class WebSocket support via `@nestjs/websockets` and `@WebSocketGateway`. The frontend would connect on login and receive push notifications. More complex but better UX.

Not blocking for v1, but plan for it. The current Notification Center UI works either way — only the data source changes.

### 8. CORS and Environment Configuration

NestJS will need explicit CORS configuration to accept requests from the Vite dev server (`http://localhost:5173`) and the production frontend domain. Use `app.enableCors({ origin: [...] })` in `main.ts` on the NestJS side.

The frontend's `apiClient.ts` should read the API base URL from `import.meta.env.VITE_API_BASE_URL` so dev/staging/prod can point to different NestJS instances without code changes.

### 9. Simulated Outcomes Must Be Removed

Several mock flows use weighted random outcomes that need to be deleted on integration:

- Payment simulation in `paymentService.ts` (75% success / 15% fail / 10% gateway unavailable) — replace with real CashPlus callback handling
- Mukhtar signature 5% random failure in `mukhtarService.ts` — replace with real cryptographic signing
- Biometric ML feedback "ALL CLEAR ~30% probability" in `BiometricCaptureWidget.tsx` — replace with real ML inference results from the backend
- OTP code generation and `console.log` in `authService.ts` — replace with real SMS gateway

Search for `Math.random()` across the codebase before deploying — every occurrence is mock plumbing that must be removed or replaced.

### 10. Order of Backend Integration

Recommended sequence to minimize integration pain:

1. **Auth first** — login, signup, OTP. Get JWT flow working end-to-end.
2. **Identity verification** — KYC submission and status retrieval.
3. **Application CRUD** — create, list, get by ID, update status.
4. **File uploads** — wire document upload endpoints.
5. **Payment integration** — real CashPlus gateway.
6. **Mukhtar and Officer flows** — protected by role guards.
7. **Notifications** — polling first, WebSockets later if needed.
8. **ML pipeline** — biometric inference, document verification (likely a separate service called by NestJS).
9. **LibanPost integration** — delivery manifest and callbacks.

Each step should keep the rest of the app working in mock mode via a feature flag (e.g., `VITE_USE_MOCK_AUTH=true`), so partial integration doesn't break the demo.

---

_Last updated: Session 8 — Citizen Portal Completion_
