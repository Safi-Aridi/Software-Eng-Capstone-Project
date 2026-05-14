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
| Route | Component |
|---|---|
| `/` | CitizenLoginPage |
| `/signup` | CitizenSignupPage |
| `/authorized-login` | AuthorizedLoginPage |
| `/identity-verification` | IdentityVerificationPage |
| `/citizen/dashboard` | CitizenDashboard (protected) |
| `/mukhtar/dashboard` | MukhtarDashboard (protected) |

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
| User | Email | Password | KYC Status |
|---|---|---|---|
| Ahmad Khalil | pending@test.com | test123 | PENDING_IDENTITY_VERIFICATION |
| Sara Mansour | accepted@test.com | test123 | IDENTITY_VERIFIED |
| Omar Fayyad | rejected@test.com | test123 | IDENTITY_REJECTED |

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
| Route | Component |
|---|---|
| `/application/new` | NewPassportApplicationPage (protected) |

### Application Form — 5 Steps (later expanded to 6, see Session 7):
| Step | Content |
|---|---|
| 1 — Type Selection | "New Passport" or "Passport Renewal" option cards |
| 2 — Passport Details | Validity (5yr / 10yr), calculated fee (200,000 / 350,000 LBP) |
| 3 — Document Upload | Identity doc + passport photo (both flows); old passport scan (renewal only) |
| 4 — Mukhtar Form & Biometrics | Address, District, Mukhtar name; mock biometric capture (new only) |
| 5 — Review & Submit | Read-only summary, submit saves to localStorage, redirects to dashboard |

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
  applicationType: 'NEW' | 'RENEWAL';
  currentStatus: 'PENDING_REVIEW' | 'VERIFIED' | 'MUKHTAR_SIGNED' | 'PROCESSED' | 'RESUBMISSION_REQUIRED' | 'DELIVERED';
  submissionDate: string;
  trackingNumber: string;         // NPIS-2026-XXXXXX
  passportValidity: 5 | 10;
  feeAmount: number;
  paymentStatus: 'UNPAID' | 'Paid' | 'Failed';
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
| Route | Component |
|---|---|
| `/application/status/:applicationId` | ApplicationStatusPage (protected) |
| `/application/resubmit/:applicationId` | DocumentResubmissionPage (protected) |

### Status Timeline Stages (in order) — later expanded to 7 stages, see Session 11:
1. Application Submitted
2. Documents Under Review
3. Verified by System
4. Mukhtar Signed
5. Processed for Issuance
6. Delivered

### Estimated Completion Mock Logic (FR-11) — updated in Session 11:
| Status | Estimate Shown |
|---|---|
| PENDING_REVIEW | 5–7 business days |
| VERIFIED | 3–5 business days |
| MUKHTAR_SIGNED | 2–3 business days |
| PROCESSED | 1–2 business days |
| DELIVERED | Completed |
| RESUBMISSION_REQUIRED | On hold — awaiting resubmission |

### Additional Test Applications Seeded:
| User | App | Type | Status | Tracking |
|---|---|---|---|---|
| Sara Mansour (user_002) | App 1 | NEW | MUKHTAR_SIGNED | NPIS-2026-000001 |
| Sara Mansour (user_002) | App 2 | RENEWAL | PENDING_REVIEW | NPIS-2026-000002 |
| Ahmad Khalil (user_001) | App 1 | NEW | RESUBMISSION_REQUIRED | NPIS-2026-000003 |

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
| Service | SRS Coverage | Future Endpoint |
|---|---|---|
| authService | FR-03, FR-04, FR-05 | POST /api/auth/login, /register |
| applicationService | FR-06, FR-08, FR-10, FR-11 | GET/POST /api/applications |
| notificationService | FR-23, FR-32 | GET /api/notifications |
| paymentService | FR-09, FR-28, FR-29, FR-30 | POST /api/payments/initiate |
| mukhtarService | FR-13, FR-15, FR-16 | GET/POST /api/mukhtar/applications |
| officerService | FR-18, FR-19 | POST /api/officer/applications/:id/approve |

**Commit:** `feat: Implement passport application workflow and service architecture`

---

## Session 4 — Mukhtar & GS Officer Dashboards (Phase 5 & 6)

### Note:
Session 4 scaffolded the Mukhtar and Officer dashboard files and service stubs. The dashboards were non-interactive placeholders at this stage. Full functional implementation was completed in Session 9.

### Files Created:
- `src/pages/MukhtarDashboard.tsx` — scaffolded (non-functional at this stage)
- `src/pages/OfficerDashboard.tsx` — scaffolded (non-functional at this stage)

### Files Modified:
- `src/services/mukhtarService.ts` — stub functions added
- `src/services/officerService.ts` — stub functions added
- `AuthorizedLoginPage.tsx` — updated to route `mukhtar` role → `/mukhtar/dashboard`, `officer` role → `/officer/dashboard`
- `App.tsx` — added protected routes for both dashboards
- `src/utils/seedTestData.ts` — seeded Mukhtar and Officer test users

### Routes Added:
| Route | Component |
|---|---|
| `/mukhtar/dashboard` | MukhtarDashboard (protected, role: mukhtar) |
| `/officer/dashboard` | OfficerDashboard (protected, role: officer) |

### Test Users Added:
| User | Email | Password | Role |
|---|---|---|---|
| Khalil Raad | mukhtar@test.com | test123 | mukhtar |
| Rima Sleiman | officer@test.com | test123 | officer |

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
| Route | Component |
|---|---|
| `/application/pay/:applicationId` | PaymentPage (protected, citizen only) |

### Payment Flow:
1. Citizen submits application → saved with `paymentStatus: 'UNPAID'` → redirected to PaymentPage
2. PaymentPage shows: tracking number, type, validity, fee amount prominently, CashPlus branding placeholder
3. "Pay Now" triggers 2-second loading state ("Connecting to CashPlus gateway...")
4. Weighted random outcome simulation:
   - 75% SUCCESS → `paymentStatus: 'Paid'` → green confirmation → countdown → redirect to dashboard
   - 15% FAILED → `paymentStatus: 'Failed'` → red panel → "Retry Payment" option → failure notification created
   - 10% GATEWAY UNAVAILABLE → no state change → amber panel → "Return to Dashboard"
5. Back-navigation guard using React Router `useBlocker` (no `window.unload` events)
6. FR-30: On dashboard load, applications with `paymentStatus: 'UNPAID'` older than 15 minutes are auto-failed

---

## Session 6 — Routing Bug Fixes

### Problems Fixed:
- **White screen on page reload**: Fixed by adding `historyApiFallback: true` to `vite.config.ts` and creating `public/_redirects` for deployment.
- **Back button not re-rendering page**: Fixed duplicate Router mounting issue in `App.tsx` / `main.tsx`.
- **`unload` Permissions Policy violation**: Removed all `window.addEventListener('beforeunload'/'unload', ...)` calls. Replaced PaymentPage back-navigation guard with React Router's `useBlocker` hook.

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
- `CitizenSignupPage.tsx` — added 2-step OTP flow
- `authService.ts` — added `generateOtp()` and `validateOtp()` with localStorage mock
- `NewPassportApplicationPage.tsx` — expanded from 5 to 6 steps
- `App.tsx` — added DevStatusPanel (dev mode only); wrapped citizen routes in CitizenLayout

### Application Form — Final 6-Step Structure:
| Step | Content | Shown For |
|---|---|---|
| 1 — Type Selection | New Passport / Passport Renewal | Both |
| 2 — Passport Details | Validity, fee calculation | Both |
| 3 — Document Upload | Identity doc, passport photo, old passport | Both (old passport: renewal only) |
| 4 — Mukhtar Details | Address, district, mukhtar name | Both |
| 5 — Biometric Capture | Face + fingerprint simulation | NEW only |
| 6 — Review & Submit | Read-only summary, fee acknowledgment | Both |

### Dev Status Panel:
- Visible only in dev mode (`import.meta.env.DEV === true`)
- Status overrides: PENDING_REVIEW / VERIFIED / MUKHTAR_SIGNED / PROCESSED / RESUBMISSION_REQUIRED / DELIVERED
- Payment status override: UNPAID / Paid / Failed
- "Reload Dashboard", "Clear All Applications", "Re-seed Test Data"

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
- `CitizenDashboard.tsx` — notification bell with badge, profile link, application filter/sort toolbar
- `CitizenLoginPage.tsx` — account lockout countdown panel
- `authService.ts` — lockAccount, isAccountLocked, getRemainingLockTime
- `notificationService.ts` — markAsRead, markAllAsRead, getUnreadCount
- `DocumentResubmissionPage.tsx` — rejection reasons, acceptance criteria, accepted-field indicators
- `applicationService.ts` — added resubmissionReasons field to PassportApplication interface
- `NewPassportApplicationPage.tsx` — fee acknowledgment checkbox on Step 6
- `DevStatusPanel.tsx` — seeds mock resubmissionReasons when setting RESUBMISSION_REQUIRED
- `App.tsx` — added /application/checklist and /citizen/profile routes

### Routes Added:
| Route | Component |
|---|---|
| `/application/checklist` | PreApplicationChecklistPage (protected, citizen) |
| `/citizen/profile` | CitizenProfilePage (protected, citizen) |

**Commit:** `feat: Complete citizen portal — notifications, profile, lockout, resubmission reasons, fee acknowledgment (Session 8)`

---

## Session 9 — Mukhtar & GS Officer Dashboards — Full Build (Phase 9)

### Context:
Session 4 scaffolded these dashboards as non-interactive placeholders. This session replaced them entirely with fully functional implementations.

### SRS Requirements Covered:
- FR-12 to FR-16: Mukhtar authentication, queue, citizen data display, e-signature, status update
- FR-17 to FR-19: GS Officer authentication, approval queue, final approval
- FR-22, FR-23: Resubmission trigger from Mukhtar with rejection reasons and citizen notification

### Files Rebuilt:
- `src/pages/MukhtarDashboard.tsx` — full implementation replacing the Session 4 placeholder
- `src/pages/OfficerDashboard.tsx` — full implementation replacing the Session 4 placeholder

### Files Modified:
- `src/services/mukhtarService.ts` — `getPendingApplications()`, `signApplication()`, `requestResubmission()` fully implemented
- `src/services/officerService.ts` — `getPendingApplications()`, `approveApplication()`, `cancelOldPassport()` fully implemented
- `src/services/notificationService.ts` — confirmed `create()` function present and used by all staff actions
- `src/utils/seedTestData.ts` — seeded VERIFIED and MUKHTAR_SIGNED test applications for staff queue testing

### Mukhtar Dashboard Features:
- Pending queue filtered by `currentStatus === 'VERIFIED'`
- Loading state (skeleton/spinner) and empty state with friendly message
- Each card: tracking number, applicant name, type, submission date, district
- Detail drawer (slide-in): full citizen data, document thumbnails, application summary
- **Approve & Sign** flow:
  - Confirmation modal before signing
  - 5% random cryptographic signature failure simulation
  - On success: `currentStatus` → `MUKHTAR_SIGNED`, `mukhtar_signature_<applicationId>` written with timestamp
  - Citizen notification created: "Your application has been signed by your Mukhtar"
  - Marked `// TODO: Remove notification call when backend connected — NestJS handles server-side`
  - On failure: error toast, no state change, no partial corruption
- **Request Resubmission** flow:
  - Modal with per-document checkboxes (Identity Document, Passport Photo, Old Passport for renewals) and rejection reason textarea per document
  - Populates `resubmissionReasons` on the application record matching the shape `DocumentResubmissionPage` expects
  - `currentStatus` → `RESUBMISSION_REQUIRED`
  - Citizen notification created (FR-23)
- All toasts auto-dismiss after 3 seconds

### GS Officer Dashboard Features:
- Pending queue filtered by `currentStatus === 'MUKHTAR_SIGNED'`
- Cards show Mukhtar signature timestamp
- Detail panel: full application data, Mukhtar signature timestamp and name
- **Final Approval** (renamed "Approve for Issuance" in Session 11):
  - For NEW: single confirmation modal → `currentStatus` → `PROCESSED`
  - For RENEWAL at this stage: old passport cancellation modal removed (moved to ISSUED in Session 11)
  - Citizen notification created on approval
- All notification side-effects marked with TODO for NestJS removal

### Test Applications Seeded:
| User | Type | Status | Tracking |
|---|---|---|---|
| Sara Mansour | NEW | VERIFIED | NPIS-2026-000004 |
| Sara Mansour | NEW | VERIFIED | NPIS-2026-000005 |
| Sara Mansour | RENEWAL | VERIFIED | NPIS-2026-000006 |
| Sara Mansour | NEW | MUKHTAR_SIGNED | NPIS-2026-000007 |
| Sara Mansour | RENEWAL | MUKHTAR_SIGNED | NPIS-2026-000008 |

**Commit:** `feat: Build functional Mukhtar and GS Officer dashboards (Phase 9)`

---

## Session 10 — Citizen UX Enhancements (Phase 10)

### Features Added:
- Application receipt download (PDF, client-side via jsPDF)
- Passport expiry reminder banners on Citizen Dashboard
- Renewal pre-selection fix from expiry banner

### Files Created:
- `src/services/receiptService.ts` — `generateReceipt(applicationId)` builds and downloads PDF via jsPDF

### Files Modified:
- `PaymentPage.tsx` — countdown extended from 3 to 5 seconds; pauses on receipt download; switches to manual "Continue" after download; always-visible "Go to Dashboard" button
- `CitizenDashboard.tsx` — "Download Receipt" button on paid application cards; expiry reminder banners at top of dashboard
- `applicationService.ts` — added `getExpiringPassports()` and `dismissExpiryBanner()` (later moved to `passportService.ts` in Session 11)
- `PreApplicationChecklistPage.tsx` — reads `?type` query param, forwards to application form, updates checklist copy for renewal-specific document requirements
- `NewPassportApplicationPage.tsx` — reads `?type` param on mount, pre-selects application type, skips Step 1 when param present; Back from Step 2 returns to checklist/dashboard not Step 1
- `seedTestData.ts` — three DELIVERED applications seeded under Sara Mansour covering all three expiry severity tiers

### Receipt Content:
PDF includes tracking number, applicant name, application type, validity, submission date, fee amount, payment status, payment reference (gatewayRef), payment date, current status, and footer. Filename: `NPIS_Receipt_<trackingNumber>.pdf`. Marked TODO for server-generated signed PDF on backend integration.

### Expiry Reminder Banners:
Three severity tiers based on time until expiry:
- **Info** (6–3 months): Blue, dismissible
- **Warning** (3–1 month): Amber, not dismissible
- **Critical** (<1 month / expired): Red, not dismissible

Banners render at top of dashboard, stacked critical → warning → info. Each has a "Renew Now" button routing to `/application/checklist?type=RENEWAL&fromExpiry=<applicationId>`. Info-tier dismissal stored per passport; clears automatically if severity escalates.

### Renewal Pre-Selection Fix:
- "Renew Now" routes to `/application/checklist?type=RENEWAL&fromExpiry=<applicationId>`
- Checklist forwards `?type=RENEWAL` to `/application/new?type=RENEWAL`
- Form skips Step 1 and opens at Step 2 with RENEWAL pre-selected
- Back button from pre-selected Step 2 goes to checklist/dashboard, not Step 1
- Direct `/application/new` navigation without param is unchanged

**Commit:** `feat: Citizen UX enhancements — receipt download, expiry reminders, and renewal pre-selection (Phase 10)`

---

## Session 11 — Passport Entity, ISSUED State & Expiry Banner Wiring (Phase 11)

### Context:
This session introduced the most significant data model addition since Session 3. A new `Passport` entity was introduced as an independent record, decoupled from the application. A new `ISSUED` status was added to the application state machine between `PROCESSED` and `DELIVERED`. The GS Officer workflow was restructured into two distinct stages. The expiry banner data source was re-wired from application records to passport records.

### Architectural Decisions:
- **Passport record created at ISSUED** by the GS Officer, who enters the booklet number manually. All other fields derived automatically.
- **Old passport cancelled at ISSUED** for renewals — simultaneously with new passport creation. Not at PROCESSED, not at DELIVERED. This is a deliberate deviation from FR-19 (which places cancellation at PROCESSED) justified by real-world accuracy: the old passport should not be cancelled before the new one physically exists.
- **LibanPost manifest trigger (FR-31) moved from PROCESSED to ISSUED** — it makes more sense to notify LibanPost once the passport physically exists, not merely when it is approved for printing.
- **DELIVERED is terminal and automated** — triggered by LibanPost callback (mocked via Dev Panel). No Officer action at DELIVERED.
- **Expiry banner reads from Passport records**, not application records.

### Updated Application State Machine:
```
PENDING_REVIEW → VERIFIED → MUKHTAR_SIGNED → PROCESSED → ISSUED → DELIVERED
```

| Status | Triggered By | Side Effects |
|---|---|---|
| PENDING_REVIEW | Citizen submits | Payment initiated |
| VERIFIED | ML system (Dev Panel) | Routed to Mukhtar queue |
| MUKHTAR_SIGNED | Mukhtar signs | Citizen notified, routed to Officer queue |
| PROCESSED | GS Officer (Queue 1) | Approved for printing, no passport data yet |
| ISSUED | GS Officer (Queue 2) | Passport record created, old passport cancelled (renewal), LibanPost manifest sent, citizen notified |
| DELIVERED | LibanPost callback (Dev Panel) | Application closed, citizen notified |

### Files Created:
- `src/types/passport.ts` — Passport interface
- `src/services/passportService.ts` — full passport CRUD and expiry logic

### Files Modified:
- `src/services/applicationService.ts` — added `'ISSUED'` to currentStatus union; added `renewingPassportId: string | null` to PassportApplication interface; removed `getExpiringPassports()` and `dismissExpiryBanner()` (moved to passportService)
- `src/pages/OfficerDashboard.tsx` — restructured into two-tab layout
- `src/pages/ApplicationStatusPage.tsx` — expanded timeline to 7 stages; updated estimated completion table
- `src/pages/NewPassportApplicationPage.tsx` — resolves `fromExpiry` param to `passportId`, writes `renewingPassportId` on renewal applications
- `src/pages/CitizenDashboard.tsx` — expiry banner re-wired to `passportService.getExpiringPassports()`
- `src/components/DevStatusPanel.tsx` — ISSUED override prompts for booklet number and creates passport record; DELIVERED override safe-creates passport if absent; removed `deliveredDate` override from Session 10
- `src/utils/seedTestData.ts` — passport records added for Sara Mansour's three near-expiry DELIVERED applications; `deliveredDate` field removed from those applications

### Passport Interface:
```typescript
interface Passport {
  passportId: string;           // LBPP-<8 digits>
  userId: string;
  sourceApplicationId: string;
  bookletNumber: string;        // LB-XXXXXXX, entered by Officer
  status: 'ACTIVE' | 'CANCELLED';
  issuedAt: string;             // ISO timestamp — when Officer marks ISSUED
  expiresAt: string;            // computed: issuedAt + passportValidity years
  cancelledAt: string | null;
  cancelledByApplicationId: string | null;
}
```

### PassportApplication Interface (updated):
```typescript
interface PassportApplication {
  applicationId: string;
  userId: string;
  applicationType: 'NEW' | 'RENEWAL';
  currentStatus: 'PENDING_REVIEW' | 'VERIFIED' | 'MUKHTAR_SIGNED' |
                 'PROCESSED' | 'ISSUED' | 'RESUBMISSION_REQUIRED' | 'DELIVERED';
  submissionDate: string;
  trackingNumber: string;
  passportValidity: 5 | 10;
  feeAmount: number;
  paymentStatus: 'UNPAID' | 'Paid' | 'Failed';
  renewingPassportId: string | null;  // passportId of passport being renewed
  resubmissionReasons: { [documentKey: string]: string } | null;
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

### passportService.ts Functions:
| Function | Purpose | Future Endpoint |
|---|---|---|
| `createPassport()` | Creates ACTIVE passport record at ISSUED | POST /api/passports |
| `getPassportsByUser()` | Returns all passport records for a citizen | GET /api/passports?userId= |
| `getActivePassport()` | Returns single ACTIVE passport or null | GET /api/passports/active?userId= |
| `cancelPassport()` | Sets status → CANCELLED with timestamp | PATCH /api/passports/:id/cancel |
| `getExpiringPassports()` | Returns ACTIVE passports expiring within 6 months with severity and suppression logic | GET /api/passports/expiring?userId= |
| `dismissExpiryBanner()` | Writes dismissal flag per passport per severity | POST /api/passports/:id/dismiss-expiry-banner |

### localStorage Key Added:
- `passports_<userId>` — array of Passport records per citizen

### GS Officer Dashboard — Two-Tab Structure:
**Tab 1 — "Pending Approval"** (MUKHTAR_SIGNED queue):
- Renamed action: "Approve for Issuance" (was "Final Approval")
- On confirm: `currentStatus` → `PROCESSED`, citizen notified
- No passport creation, no cancellation at this stage

**Tab 2 — "Ready for Issuance"** (PROCESSED queue):
- Booklet number entry form with format validation (LB-XXXXXXX)
- For RENEWAL: warning box before issuing ("This will cancel the passport on file")
- On confirm:
  1. `passportService.createPassport()` called
  2. For RENEWAL: `passportService.cancelPassport()` called on `renewingPassportId`
  3. `currentStatus` → `ISSUED`
  4. LibanPost manifest mock log: `console.log('LibanPost manifest sent:', {...})` — marked TODO FR-31
  5. Citizen notification created (different message for NEW vs RENEWAL)
- Count badges on both tab headers

### Application Status Timeline — Updated (7 Stages):
1. Application Submitted
2. Documents Under Review
3. Verified by System
4. Mukhtar Signed
5. Approved for Printing *(was "Processed for Issuance")*
6. Passport Issued *(new)*
7. Delivered

### Updated Estimated Completion Table (FR-11):
| Status | Estimate Shown |
|---|---|
| PENDING_REVIEW | 5–7 business days |
| VERIFIED | 3–5 business days |
| MUKHTAR_SIGNED | 2–3 business days |
| PROCESSED | 1–2 business days |
| ISSUED | Passport issued — awaiting delivery |
| DELIVERED | Completed |
| RESUBMISSION_REQUIRED | On hold — awaiting resubmission |

### Expiry Banner Suppression Logic:
Banner for a passport is suppressed when ALL of:
- A renewal application exists with `renewingPassportId === passportId`
- That renewal's `currentStatus` is one of: PENDING_REVIEW, VERIFIED, MUKHTAR_SIGNED, PROCESSED, ISSUED
- That renewal's `paymentStatus` is `'Paid'`

Banner reappears when:
- Renewal `currentStatus` is `RESUBMISSION_REQUIRED`
- Renewal `paymentStatus` is `'UNPAID'` or `'Failed'`
- No renewal references this passport

**Commit:** *(pending — Session 11 just completed)*

---

## Current Application Status Summary

### What's Complete:
- ✅ Citizen signup with OTP mobile validation UI (mock SMS)
- ✅ Citizen login and logout
- ✅ Account lockout countdown UI (FR-05.1)
- ✅ Identity verification (KYC) flow — pending, accepted, rejected, resubmission
- ✅ Role-based routing and protected routes
- ✅ Citizen profile page — view and edit profile/contact information
- ✅ Pre-application document checklist — generic and renewal-specific variants
- ✅ Multi-step passport application form — 6 steps (NEW) / 5 steps (RENEWAL)
- ✅ Renewal pre-selection from expiry banner — skips Step 1, Back button safe
- ✅ Fee acknowledgment checkbox on Step 6
- ✅ Document upload with drag-and-drop, preview, validation
- ✅ Biometric capture UI — manual trigger, ML feedback simulation, 3-second stability timer, face + fingerprints
- ✅ Payment flow — dedicated PaymentPage, CashPlus simulation (success/fail/unavailable), FR-30 timeout auto-fail
- ✅ Payment countdown extended to 5 seconds; pauses on receipt download
- ✅ Application receipt download (jsPDF, client-side) — on PaymentPage success and dashboard cards
- ✅ Application status timeline — 7 stages including new ISSUED stage
- ✅ Document resubmission flow with per-document rejection reasons and acceptance criteria
- ✅ Notification banners for action-required applications (resubmission, payment, expiry)
- ✅ Notification Center UI — bell badge, read/unread state, mark as read, mark all as read
- ✅ Application filtering/sorting on CitizenDashboard
- ✅ Passport expiry reminder banners — 3 severity tiers, dismissal, suppression during active renewal
- ✅ Mukhtar Dashboard — VERIFIED queue, detail drawer, e-signature with 5% failure sim, resubmission trigger with per-document reasons, citizen notifications
- ✅ GS Officer Dashboard — two-tab layout (MUKHTAR_SIGNED → PROCESSED → ISSUED), booklet number entry, passport record creation, old passport cancellation for renewals, LibanPost mock log
- ✅ Passport entity — independent record per issued passport, drives expiry logic
- ✅ ISSUED status — new state between PROCESSED and DELIVERED
- ✅ AI assistant floating chat widget (Anthropic API)
- ✅ Developer status override panel (dev mode only) — includes ISSUED override with passport creation
- ✅ Full API service layer with mock implementations and TODO markers
- ✅ Test data seeding for all user/application/payment/passport states
- ✅ Routing fixed — reload, back button, no unload violations

### What's Not Yet Built:
- ⬜ ML document verification pipeline — automated status transitions FR-20 to FR-27 (deferred; Dev Panel bridges gap)
- ⬜ LibanPost delivery integration — FR-31 to FR-33 (deferred; mocked as console.log at ISSUED)
- ⬜ Real backend integration — replace all localStorage mocks with API calls through `apiClient.ts`
- ⬜ OTP SMS gateway — UI complete, real SMS not connected (FR-02 backend)
- ⬜ Real CashPlus gateway — UI complete, real payment not connected (FR-09 backend)
- ⬜ Real biometric ML — UI complete, FaceNet/U-Net inference not connected (FR-07 backend)
- ⬜ renewingPassportId for renewals started outside the expiry banner (v1 limitation — flagged in code)
- ⬜ Multi-passport UI for citizens with more than one active passport (v1 simplification — flagged in code)

---

## Next Steps (Priority Order)

### 1. Real Backend Integration — When Team API Stabilizes
Follow the sequence in Backend Integration Notes section 10. All frontend service functions have TODO markers. The recommended order is: Auth → Identity Verification → Application CRUD → File Uploads → Payment → Mukhtar/Officer flows → Notifications → ML Pipeline → LibanPost.

### 2. ML Document Verification (Deferred)
- Automated status transitions: PENDING_REVIEW → VERIFIED or RESUBMISSION_REQUIRED (FR-20–FR-22)
- Mukhtar routing by jurisdiction (FR-24)
- Post-signature integrity check (FR-25–FR-26)
- Branch processing speed calculation (FR-27)

### 3. LibanPost Delivery Integration (Deferred)
- Delivery manifest transmission on ISSUED status (FR-31) — trigger point updated from PROCESSED
- Citizen delivery notification (FR-32)
- Delivery/swap closure callback → DELIVERED or Delivery Failed (FR-33)

---

## ⚠️ IMPORTANT — Backend Integration Notes (NestJS)

These are gotchas to address when wiring the frontend to the NestJS backend. Read this section before starting backend integration.

### 1. Simulated Backend Side-Effects Are Present and Must Be Removed
All staff-side state transitions (Mukhtar sign, Mukhtar resubmission request, Officer PROCESSED approval, Officer ISSUED passport creation) now create citizen notifications via `notificationService.create()`. These calls are marked:
```
// TODO: Remove when backend is connected — NestJS handles notification creation server-side
```
Search for this comment and delete every occurrence during integration. The backend will handle notifications via service layer, event emitters, or database triggers.

### 2. New Passport Entity — Requires Backend Table
The frontend introduced a `Passport` entity stored under `passports_<userId>` in localStorage. The backend needs a dedicated `Passport` table (or equivalent) with the following fields:
- `passportId` (string, generated)
- `userId` (FK to User)
- `sourceApplicationId` (FK to Application)
- `bookletNumber` (string, entered by Officer)
- `status` (enum: ACTIVE / CANCELLED)
- `issuedAt` (timestamp)
- `expiresAt` (timestamp, computed server-side)
- `cancelledAt` (timestamp, nullable)
- `cancelledByApplicationId` (FK to Application, nullable)

This maps to the SRS section 3.1 entity list, which implies this record exists but does not name it explicitly. The `Old Passport Cancellation` entity in SRS 3.1 maps to the `cancelledAt` / `cancelledByApplicationId` fields on this record.

### 3. ISSUED Is a New Status Not in the SRS
The `ISSUED` status was added as a deliberate extension of FR-18. The SRS defines PROCESSED as the terminal Officer action. The frontend team added ISSUED to represent the moment the physical booklet is produced and handed to LibanPost, which is distinct from PROCESSED (approved for printing). The backend state machine must include ISSUED as a valid status between PROCESSED and DELIVERED.

Valid status transitions:
```
PENDING_REVIEW → VERIFIED → MUKHTAR_SIGNED → PROCESSED → ISSUED → DELIVERED
PENDING_REVIEW → RESUBMISSION_REQUIRED → PENDING_REVIEW (resubmission loop)
```

### 4. Old Passport Cancellation Moved to ISSUED (Deviation from FR-19)
FR-19 places old passport cancellation at the Officer's final approval action (PROCESSED). The frontend team moved this to ISSUED — the moment the new passport physically exists. The backend should implement cancellation at ISSUED, not at PROCESSED. This is a justified deviation: cancelling the old passport at PROCESSED creates a window where the citizen has no valid passport if delivery fails.

### 5. LibanPost Manifest Trigger Moved to ISSUED (Deviation from FR-31)
FR-31 places the LibanPost manifest transmission at PROCESSED. The frontend team moved this to ISSUED. The backend should trigger the LibanPost API call when status becomes ISSUED, not PROCESSED. Rationale: LibanPost should only receive the manifest once the physical passport exists and is ready for collection.

### 6. renewingPassportId on Application
The `PassportApplication` entity now carries `renewingPassportId: string | null`. This links a renewal application to the specific passport record being renewed. The backend Application table needs this FK column. It is null for NEW applications and for renewals started outside the expiry banner flow (v1 limitation). The backend may want to enforce this FK more strictly or populate it via a lookup during application creation.

### 7. Async/Sync Consistency
All service functions are async and return Promises. localStorage operations are synchronous under the hood. When connected to NestJS via HTTP, real latency will surface. Audit every service caller to confirm `await` is used before integration.

### 8. Data Shape Drift Between Frontend and NestJS DTOs
The frontend uses camelCase TypeScript interfaces. NestJS may return snake_case DTOs, numeric IDs, or differently shaped nested objects. Build adapter functions inside each service (`mapApiApplicationToFrontend(dto)`, `mapApiPassportToFrontend(dto)`) to translate shapes. Components stay untouched — only service internals change.

### 9. localStorage-Only Keys With No Backend Equivalent
These keys exist only as frontend mock plumbing and have no backend counterpart:
- `passports_<userId>` — backend has a Passport table
- `mukhtar_signature_<applicationId>` — backend stores signatures via a Signature entity
- `payment_<applicationId>` — backend has a Payment table
- `otp_<mobile>` — OTP is server-side only
- `kyc_status_<userId>`, `identity_data_<userId>` — backend stores on User/CitizenProfile entity
- `expiry_banner_dismissed_<passportId>` — backend may store as a user preference or ignore (UI-only concern)

Grep for all localStorage keys outside `src/services/`. Any direct access in a component is a bug.

### 10. Authentication Token Handling
Current session is just a userId in localStorage. NestJS will use JWT. Confirm `apiClient.ts` has interceptor logic to attach `Authorization: Bearer <token>`. Handle 401 globally — clear token and redirect to `/`.

### 11. File Uploads — Significant Interface Change
Documents are currently stored as base64 strings. The real flow: upload via multipart/form-data → NestJS returns URL → submit application with URL. The `documents` field will hold URLs instead of base64 strings. `<img src={...}>` works for both, so component changes are minimal.

### 12. Simulated Outcomes Must Be Removed
Search for `Math.random()` across the codebase before deploying:
- Payment simulation (75/15/10 split) in `paymentService.ts`
- Mukhtar signature 5% failure in `mukhtarService.ts`
- Biometric ML feedback ~30% ALL CLEAR in `BiometricCaptureWidget.tsx`
- OTP generation and `console.log` in `authService.ts`

### 13. Order of Backend Integration
1. Auth — login, signup, OTP, JWT flow
2. Identity verification — KYC submission and status
3. Application CRUD — create, list, get by ID, update status (ensure ISSUED is a valid status)
4. Passport CRUD — create, cancel, list by user, expiry query
5. File uploads — switch from base64 to multipart/URL
6. Payment integration — real CashPlus gateway
7. Mukhtar and Officer flows — role guards, signature, passport issuance
8. Notifications — polling first, WebSockets later
9. ML pipeline — biometric inference, document verification
10. LibanPost integration — delivery manifest at ISSUED, callbacks for DELIVERED

Each step should keep the rest of the app working in mock mode via feature flags (`VITE_USE_MOCK_AUTH=true` etc.) so partial integration doesn't break the demo.

### 14. Real-Time Notifications
Notification center currently refreshes on open/reload only. For production: start with polling every 30–60 seconds. Upgrade to WebSockets (`@nestjs/websockets`, `@WebSocketGateway`) for live push. The Notification Center UI supports both — only the data source changes.

### 15. CORS and Environment Configuration
NestJS needs `app.enableCors({ origin: [...] })` for the Vite dev server and production domain. Frontend reads API base URL from `import.meta.env.VITE_API_BASE_URL`.

---

## Session 12 — Backend Integration: Auth & Applications

### Branch
`feature/backend-integration` — contains both frontend (root/frontend/) 
and backend (root/backend/) after merging frontend-branch and 
nestjs-backend-foundation into a single integration branch.

### What Was Integrated

#### 1. API Client (frontend/src/services/apiClient.ts)
Activated from dormant state. Now:
- Reads base URL from VITE_API_BASE_URL (defaults to http://localhost:5000/api)
- Attaches Authorization: Bearer <token> from localStorage key 'npis_token' 
  on every request
- On 401 response: clears 'npis_token' and 'npis_session', redirects to '/'
- Exposes: get<T>, post<T>, put<T>, patch<T>
- Throws typed ApiError with { status, message } on non-2xx responses

#### 2. Adapter Layer (frontend/src/utils/apiAdapters.ts) — NEW FILE
Created to decouple backend data shapes from frontend types.
All components remain untouched — only service files use these adapters.

Functions:
- snakeToCamel(obj): recursively converts snake_case keys to camelCase
- backendStatusToFrontend(s): maps backend Title Case status strings to 
  frontend SCREAMING_SNAKE_CASE
- frontendStatusToBackend(s): reverse mapping
- backendPaymentStatusToFrontend(s): maps 'Pending'→'UNPAID', etc.
- frontendPaymentStatusToBackend(s): reverse mapping
- backendAppTypeToFrontend(s): 'new_passport'→'NEW', 'renewal'→'RENEWAL'
- frontendAppTypeToBackend(s): reverse mapping
- mapApiApplicationToFrontend(raw): full mapping from raw DB row to 
  PassportApplication interface

Status mapping table:
| Backend (DB)                              | Frontend                |
|-------------------------------------------|-------------------------|
| 'Pending'                                 | 'PENDING_REVIEW'        |
| 'Verified'                                | 'VERIFIED'              |
| 'Mukhtar Signed'                          | 'MUKHTAR_SIGNED'        |
| 'Processed for Issuance'                  | 'PROCESSED'             |
| 'Issued'                                  | 'ISSUED'                |
| 'Resubmission Required'                   | 'RESUBMISSION_REQUIRED' |
| 'Delivered'                               | 'DELIVERED'             |
| 'Delivery Failed - Branch Collection Required' | 'DELIVERED'        |

Role mapping (backend DB → frontend):
| DB role_name | Frontend UserRole |
|--------------|-------------------|
| 'citizen'    | 'citizen'         |
| 'mukhtar'    | 'mukhtar'         |
| 'gs_officer' | 'officer'         |
| 'admin'      | 'admin'           |
This mapping is applied in backend/src/auth/auth.service.ts 
mapRoleToFrontend() before signing the JWT.

Fields with safe defaults (backend doesn't store these yet):
- passportValidity: 5
- feeAmount: 0
- renewingPassportId: null
- resubmissionReasons: null
- documents: { identityDocument: null, passportPhoto: null, oldPassport: null }
- mukhtarFormData: { address: '', district: '', mukhtarName: '' }
- biometricCaptured: false

#### 3. Environment Flags (frontend/.env.development)
| Flag                       | Value | Reason                              |
|----------------------------|-------|-------------------------------------|
| VITE_API_BASE_URL          | http://localhost:5000/api | Backend port |
| VITE_USE_MOCK_AUTH         | false | Real auth implemented               |
| VITE_USE_MOCK_APPLICATIONS | false | Real DB working                     |
| VITE_USE_MOCK_PAYMENTS     | true  | CashPlus not integrated             |
| VITE_USE_MOCK_MUKHTAR      | false | Endpoint exists                     |
| VITE_USE_MOCK_OFFICER      | false | Endpoint exists                     |
| VITE_USE_MOCK_NOTIFICATIONS| true  | No notifications table in DB        |
| VITE_USE_MOCK_PASSPORTS    | true  | No passports table in DB            |
| VITE_USE_MOCK_KYC          | true  | KYC endpoint is stub only           |

#### 4. Real Authentication (backend/src/auth/auth.service.ts)
Replaced stub with full implementation against real Supabase DB.

Login flow:
1. Query: SELECT u.*, r.role_name FROM users u JOIN roles r ON 
   u.role_id = r.role_id WHERE u.email = $1
2. Check account_status = 'locked' and locked_until timestamp
   - If still locked: return 401 with lockedUntil
   - If expired: reset account_status='active', failed_attempts=0
3. bcrypt.compare(password, password_hash)
4. Wrong password: increment failed_attempts; if >= 3 set 
   account_status='locked', locked_until = NOW() + INTERVAL '15 minutes'
5. Correct: reset failed_attempts=0, sign JWT, return token + user

JWT payload: { id: user_id, email, role: mappedRole, iat, exp }
JWT expiry: 2 hours
JWT secret: JWT_SECRET env var

Register flow:
1. Check email uniqueness
2. bcrypt hash password (saltRounds: 10)
3. INSERT INTO users with role_id=1 (citizen)
4. INSERT INTO citizen_profiles (citizen_id=user_id)
5. Return JWT + user object

#### 5. Application Service Wiring (frontend/src/services/applicationService.ts)
All functions gated behind VITE_USE_MOCK_APPLICATIONS flag.

| Function | Endpoint | Notes |
|---|---|---|
| getApplications(userId) | GET /api/applications | Filters client-side by citizenId |
| getApplicationById(id) | GET /api/applications/:id | — |
| createApplication(data) | POST /api/applications | Sends citizenId, applicationType, validityId |
| updateApplicationStatus(id, status) | PUT /api/applications/:id | Maps status to backend format |

#### 6. Mukhtar Service Wiring (frontend/src/services/mukhtarService.ts)
Gated behind VITE_USE_MOCK_MUKHTAR.

| Function | Endpoint | Notes |
|---|---|---|
| getPendingApplications() | GET /api/mukhtar/pending | Requires mukhtar JWT |
| signApplication(id, mukhtarId) | POST /api/applications/:id/sign | notificationService.create() kept as TODO |

#### 7. Officer Service Wiring (frontend/src/services/officerService.ts)
Gated behind VITE_USE_MOCK_OFFICER.

| Function | Endpoint | Notes |
|---|---|---|
| getPendingApplications() | GET /api/officer/pending | Requires officer JWT |
| approveApplication(id, officerId) | POST /api/applications/:id/approve | → 'Processed for Issuance' |
| ISSUED flow | — | Stays mocked — no backend endpoint yet |

---

### Database Schema — Key Facts for Future Integration

#### Real Supabase Tables (public schema)
All confirmed live and connected:

**users**
| Column | Type | Notes |
|---|---|---|
| user_id | uuid PK | gen_random_uuid() |
| role_id | int FK → roles | 1=citizen, 2=mukhtar, 3=gs_officer, 4=admin |
| first_name | varchar NOT NULL | |
| last_name | varchar NOT NULL | |
| email | varchar UNIQUE NOT NULL | |
| phone | varchar UNIQUE NOT NULL | |
| password_hash | text | bcrypt, saltRounds=10 |
| national_id | varchar | |
| account_status | varchar | 'active' or 'locked' |
| failed_attempts | int | default 0, resets on success |
| locked_until | timestamp | null when not locked |
| created_at | timestamp | now() |

**roles** (lookup table)
| role_id | role_name | description |
|---|---|---|
| 1 | citizen | Citizen applicant |
| 2 | mukhtar | Local verification authority |
| 3 | gs_officer | General Security officer |
| 4 | admin | System administrator |

**applications**
| Column | Type | Notes |
|---|---|---|
| application_id | uuid PK | |
| citizen_id | uuid FK → citizen_profiles | NOT users.user_id directly |
| service_type_id | int | default 1 |
| validity_id | int FK → passport_validity_options | 1=5yr, 2=10yr |
| application_type | varchar | 'new_passport' or 'renewal' |
| current_status | varchar | Title Case (see mapping table above) |
| payment_status | varchar | 'Pending', 'Paid', 'Failed' |
| tracking_number | varchar | auto-generated TRK-<timestamp> |
| assigned_mukhtar_id | uuid FK → users | nullable |
| assigned_officer_id | uuid FK → users | nullable |
| assigned_branch_id | int FK → branches | nullable |
| estimated_completion_date | date | nullable |
| created_at | timestamp | |
| completed_at | timestamp | nullable |

**citizen_profiles**
| Column | Notes |
|---|---|
| citizen_id | uuid PK — same as user_id for simplicity in current seed |
| user_id | uuid FK → users |
| date_of_birth, address, village, district, governorate | nullable |
| national_registry_number | nullable |
| phone_verified | boolean default false |

**passport_validity_options**
| validity_id | validity_years | fee_amount |
|---|---|---|
| 1 | 5 | 200.00 USD |
| 2 | 10 | 350.00 USD |

**documents** (rows, not columns on application)
Each document is a separate row with document_type:
'identity_document', 'passport_photo', 'old_passport'
file_url is a text URL (not base64 — future: Supabase Storage)

**biometric_data**
Separate table per application. verification_status: 'Pending','Verified','Failed'
face_iso_format: 'ISO/IEC 19794-5', fingerprint_iso_format: 'ISO/IEC 19794-4'

**mukhtar_forms**
form_data is JSONB. Stores address, district, mukhtarName.
signed, signed_by, electronic_signature, signed_at tracked here.

**Missing tables (frontend mocks these)**
- passports — needed for Phase 11 ISSUED flow and expiry banners
- notifications — needed for real-time status updates
- resubmission_requests — needed for ML rejection flow

---

### Backend Constraints for Future ML Integration

#### Status Transition Rules (enforce in ML service)
Valid transitions only:
PENDING_REVIEW → VERIFIED (ML approves docs)
PENDING_REVIEW → RESUBMISSION_REQUIRED (ML rejects docs)
RESUBMISSION_REQUIRED → PENDING_REVIEW (citizen resubmits)
VERIFIED → MUKHTAR_SIGNED (Mukhtar signs)
MUKHTAR_SIGNED → PROCESSED (Officer approves)
PROCESSED → ISSUED (Officer issues booklet) ← not in DB yet
ISSUED → DELIVERED (LibanPost callback) ← not in DB yet
Use application_status_history table to log every transition 
with old_status, new_status, change_reason, changed_at.

#### When ML Is Integrated (FR-20 to FR-27)
1. ML service should write directly to applications.current_status 
   via PUT /api/applications/:id with { currentStatus: 'Verified' } 
   or { currentStatus: 'Resubmission Required' }
2. ML must also write to application_status_history on every transition
3. Document verification results should update documents.verification_status
   and documents.verification_notes per document row
4. Biometric verification results go to biometric_data.verification_status
5. Mukhtar routing (FR-24) should set assigned_mukhtar_id on the application
   based on citizen's district matching mukhtar_profiles.district
6. Post-signature integrity check (FR-25) should verify the 
   electronic_signature field in mukhtar_forms

#### When Notifications Are Integrated
1. Create a notifications table with: notification_id, user_id, 
   application_id, message, is_read, created_at
2. Remove all notificationService.create() calls from frontend 
   mukhtarService.ts and officerService.ts (marked with TODO comments)
3. Backend should emit notifications on every status transition
4. Set VITE_USE_MOCK_NOTIFICATIONS=false once table exists

#### When Passports Table Is Added
1. Create passports table matching the frontend Passport interface:
   passportId, userId, sourceApplicationId, bookletNumber, 
   status (ACTIVE/CANCELLED), issuedAt, expiresAt, 
   cancelledAt, cancelledByApplicationId
2. Add ISSUED status to applications.current_status valid values
3. Add renewing_passport_id FK column to applications table
4. Add POST /api/applications/:id/issue endpoint (takes bookletNumber)
5. Set VITE_USE_MOCK_PASSPORTS=false once implemented

#### When LibanPost Is Integrated (FR-31)
Trigger manifest at ISSUED status (not PROCESSED — intentional 
deviation from SRS, see Session 11 notes).

---

### Migration Files
| File | Purpose | Status |
|---|---|---|
| backend/migrations/001_seed_test_users.sql | Seeds 5 test users + profiles | Run in Supabase |
| backend/seed.sql | Seeds 3 test applications + documents | Run in Supabase |

### Test Credentials (password: test123 for all)
| Email | Role | UUID |
|---|---|---|
| accepted.user@test.com | citizen | a1b2c3d4-0000-0000-0000-000000000001 |
| pending.user@test.com | citizen | a1b2c3d4-0000-0000-0000-000000000002 |
| rejected.user@test.com | citizen | a1b2c3d4-0000-0000-0000-000000000003 |
| mukhtar.user@test.com | mukhtar | a1b2c3d4-0000-0000-0000-000000000004 |
| officer.user@test.com | officer | a1b2c3d4-0000-0000-0000-000000000005 |

Note: emails were changed from original frontend seeds 
(accepted@test.com etc.) to avoid conflicts with existing 
Supabase rows. Update seedTestData.ts to match when wiring 
the full citizen signup flow.

### Verified Working (End-to-End Tested)
- POST /api/auth/login → real bcrypt check → JWT → 201
- GET /api/applications → real Supabase rows → 200/304
- Authorization header sent on all requests
- Status mapping: 'Mukhtar Signed' → 'MUKHTAR_SIGNED' ✅
- Role mapping: 'gs_officer' → 'officer' ✅
- Client-side userId filter matching real UUIDs ✅
- Account lockout after 3 failed attempts ✅
- Auto-unlock after 15 minutes ✅

### What Stays Mocked
- KYC submission (backend stub, no DB table)
- Payments (CashPlus not connected)
- Notifications (no DB table)
- Passports (no DB table)
- ISSUED status flow (no backend endpoint)
- Mukhtar/officer login page (loginAuthorized() still mock)
- Document upload (base64 in localStorage, no Supabase Storage)
- Application creation from form (needs citizenId from real session)

---

## Session 13 — Mukhtar & Officer Login + Dashboard Wiring

### Branch
`feature/backend-integration` (continuing from Session 12).

### What Was Wired

#### 1. `authService.loginAuthorized` → real `POST /api/auth/login`
The mukhtar/officer login page (`AuthorizedLoginPage.tsx`) calls
`authService.loginAuthorized(identifier, password)` **synchronously** —
without `await` — and immediately reads `user.role` to navigate. To avoid
touching that component, the service was kept synchronous and now uses a
blocking `XMLHttpRequest` for the real-mode network call. The function
still returns `MockUser` and still `throw`s on failure.

On success it writes:
- `localStorage['npis_token']` = JWT
- `localStorage['npis_session']` = `{ userId, email, role, fullName, isAuthenticated: true }`

Mock behaviour is preserved under `VITE_USE_MOCK_AUTH=true`. The sync-XHR
shim is the only known synchronous-IO call in the codebase and is
deliberately scoped to this one entry point until the login page is
migrated to `await` an async API.

#### 2. `mukhtarId` / `officerId` resolved from real session
`MukhtarDashboard.tsx` and `OfficerDashboard.tsx` pass
`currentUser.user.id` into the service calls. In real-auth mode
`getCurrentUser()` reads `npis_session`, so `user.id` is already the
JWT-aligned UUID — but to make the services defensive against future
caller bugs, both `mukhtarService.signApplication` and
`officerService.approveApplication` now also read `userId` directly
from `npis_session` and use that value in the POST body. The passed
parameter is the fallback. No component changes needed.

#### 3. Backend `application_status_history` writes added
`applications.service.signApplication` and `approveApplication` now:
1. `SELECT current_status` for the application (404 if missing).
2. `UPDATE applications SET current_status = ...`.
3. `INSERT INTO application_status_history (application_id, old_status,
   new_status, change_reason)`.
4. Continue to write an `audit_log` entry as before.

Change reasons: `'Mukhtar electronic signature applied'` and
`'GS Officer final approval'`.

### Backend Guard Audit
| Route | JwtAuthGuard | RolesGuard | Roles |
|---|---|---|---|
| `GET /api/mukhtar/pending`  | ✅ | ✅ | `'mukhtar'` |
| `GET /api/officer/pending`  | ✅ | ✅ | `'officer'` |
| `POST /api/applications/:id/sign`     | ❌ | ❌ | — |
| `POST /api/applications/:id/approve`  | ❌ | ❌ | — |

The mukhtar/officer pending routes already had both guards. `RolesGuard`
reads `request.user.role` populated by `JwtAuthGuard.verify()`, and the
JWT payload carries the *mapped* frontend role (`mapRoleToFrontend` in
`auth.service.ts` translates `gs_officer → officer` before signing).
Therefore `@Roles('mukhtar')` and `@Roles('officer')` are the correct
guards.

⚠️ The mutating routes on `ApplicationsController` (`/sign`, `/approve`,
plus CRUD) are **not** guarded yet. Recommended follow-up: add
`@UseGuards(JwtAuthGuard, RolesGuard)` + appropriate `@Roles(...)` per
route.

### Environment Flags
`frontend/.env.development` already had:
```
VITE_USE_MOCK_MUKHTAR=false
VITE_USE_MOCK_OFFICER=false
```
No change required this session.

### What Stays Mocked
- `mukhtarService.requestResubmission()` — backend endpoint
  `POST /api/mukhtar/applications/:id/reject` not implemented.
- `officerService.issueApplication()` and `cancelOldPassport()` — no
  ISSUED/cancellation endpoints in the backend yet.
- `notificationService.create()` calls inside both services (real flow
  still emits a frontend-only notification with a TODO marker so the
  citizen dashboard reflects the status change before notifications are
  table-backed).

### Verified
- Backend `tsc --noEmit` clean.
- Frontend `tsc --noEmit` clean.
- No `.tsx` component files modified.

### Open Questions for Session 14
1. Migrate `AuthorizedLoginPage.tsx` to `await` an async
   `loginAuthorized` and remove the sync-XHR shim.
2. Add guards to the mutating `/applications/:id/*` routes.
3. Stand up a `notifications` table and remove the frontend
   `notificationService.create()` placeholders.

---

## Session 14 — Citizen Application Creation Wired

### Branch
`feature/backend-integration` (continuing).

### What Was Wired

#### 1. `applicationService.createApplication` — real `POST /api/applications`
The real-mode branch now sources `citizenId` from `npis_session.userId`
(falling back to the `application.userId` argument for mock-mode
compatibility). The POST body sends:
```
{
  citizenId: <UUID from npis_session>,
  applicationType: 'new_passport' | 'renewal',
  validityId: 1 (5yr) | 2 (10yr),
  serviceTypeId: 1
}
```
The backend returns the full inserted row in
`{ application: <row> }`; the service runs it through
`mapApiApplicationToFrontend` and returns the mapped object.

The mapper already extracts `applicationId` from the backend's
`application_id` column via `snakeToCamel`, so the returned object's
`applicationId` is the Postgres-assigned UUID.

#### 2. Backend tracking-number format
`applications.service.create` previously generated
`TRK-${Date.now()}`. Now uses:
```
NPIS-${new Date().getFullYear()}-${6 random digits}
```
matching the format the frontend dashboard renders.

#### 3. `getApplicationById` — already wired
Verified during this session: real-mode path issues
`GET /api/applications/:id` and runs the response through
`mapApiApplicationToFrontend`. No code change needed.

#### 4. `seedTestData.ts` — application/passport seeding now gated
A guard was added: when `VITE_USE_MOCK_APPLICATIONS === 'false'`,
`seedTestDataIfNeeded` returns before seeding `applications_*`,
`passports_*`, and `mukhtar_signature_*` keys. Users + authorized users
seeding remain unconditional because they belong to the auth-mock flag.

### ⚠️ Known Issue (Component Change Required)

`NewPassportApplicationPage.tsx` generates its own
`applicationId = 'app_' + Date.now()` and navigates to
`/application/pay/${applicationId}` regardless of the value returned by
`createApplication`. In real mode the authoritative `applicationId` is
the Postgres UUID returned by the backend; the payment page will fail
to resolve the local fake id via `getApplicationById`.

**Fix (out of scope this session — requires editing the .tsx):**
```ts
const created = await applicationService.createApplication(
  currentUser.user.id, application,
);
navigate(`/application/pay/${created.applicationId}`);
```
The same fix should also drop the locally generated `trackingNumber` —
the backend now provides one. Flagged here as Session 14 follow-up.

### Still Needs Wiring
- **Payment** — `paymentService` and the payment page are still mock
  (`VITE_USE_MOCK_PAYMENTS=true`). CashPlus initiate/callback endpoints
  are stubs.
- **Documents** — files are stored as base64 in localStorage; backend
  has no Supabase Storage integration. Document rows on the backend
  exist for the three seed applications only.
- **Biometrics** — captured in-browser only; no `biometric_data` table
  writes from the create flow.
- **KYC** — still mock per `VITE_USE_MOCK_KYC=true`; account-status
  gating on the new-application form uses local KYC state.
- **NewPassportApplicationPage redirect** — see Known Issue above.

### Verified
- Backend `tsc --noEmit` clean.
- Frontend `tsc --noEmit` clean.
- No `.tsx` files modified.

---

## Session 15 - Backend-Backed Resubmission Flow

### Branch
`feature/backend-integration` (continuing).

### What Was Wired

#### 1. `resubmission_requests` migration
Added `backend/migrations/002_resubmission_requests.sql`.

Table purpose:
- Uses the existing table shape: one row per rejected document.
- Stores Mukhtar rejection feedback in `reason` text.
- Tracks whether each request has been resolved via `resolved` and `resolved_at`.

#### 2. Mukhtar resubmission endpoint
Added guarded endpoint:
```
POST /api/mukhtar/applications/:id/reject
```

Behavior:
1. Inserts one row into `resubmission_requests` per rejected document.
2. Updates `applications.current_status` to `Resubmission Required`.
3. Inserts into `application_status_history`.
4. Writes an audit log entry with action `APPLICATION_RESUBMISSION_REQUESTED`.

Frontend `mukhtarService.requestResubmission()` now calls this endpoint when
`VITE_USE_MOCK_MUKHTAR=false`.

#### 3. Citizen document resubmission endpoint
Added guarded citizen endpoint:
```
POST /api/applications/:id/resubmit
```

Behavior:
1. Updates `applications.current_status` back to `Pending`.
2. Marks unresolved `resubmission_requests` rows for the application as
   `resolved = true`.
3. Sets `resolved_at = now()`.
4. Inserts into `application_status_history`.
5. Writes an audit log entry with action `APPLICATION_DOCUMENTS_RESUBMITTED`.

Frontend `applicationService.updateApplicationDocuments()` now calls this
endpoint when `VITE_USE_MOCK_APPLICATIONS=false`.

#### 4. Rejection reasons now hydrate into frontend applications
`ApplicationsService.findAll()` and `findOne()` now aggregate unresolved
`resubmission_requests.reason` rows through `documents.document_type` and return
the result as `resubmission_reasons`.

`mapApiApplicationToFrontend()` maps it to:
```
app.resubmissionReasons
```
only while the application status is `RESUBMISSION_REQUIRED`.

### Verified
- Backend app compile: `tsc -p tsconfig.build.json --noEmit` clean.
- Frontend compile: `tsc --noEmit` clean.

### Notes
- The existing `resubmission_requests` table is reused; migration
  `002_resubmission_requests.sql` now documents that schema and adds indexes.
- Document upload is still filename-only/base64 at the UI layer; no real
  Supabase Storage integration yet.

---

## Session 16 — Security Hardening

### Branch
`feature/backend-integration` (continuing).

### Route Guards Audit & Fixes

#### `ApplicationsController` — all routes now guarded
| Route | Guards | Roles |
|---|---|---|
| `GET    /api/applications`                          | `JwtAuthGuard`              | (any authenticated) |
| `GET    /api/applications/:id`                      | `JwtAuthGuard`              | (any authenticated) |
| `GET    /api/applications/:id/status`               | `JwtAuthGuard`              | (any authenticated) |
| `POST   /api/applications`                          | `JwtAuthGuard`              | (any authenticated) |
| `PUT    /api/applications/:id`                      | `JwtAuthGuard`, `RolesGuard`| `citizen`, `mukhtar`, `officer` |
| `POST   /api/applications/:id/sign`                 | `JwtAuthGuard`, `RolesGuard`| `mukhtar` |
| `POST   /api/applications/:id/approve`              | `JwtAuthGuard`, `RolesGuard`| `officer` |
| `POST   /api/applications/:id/resubmit`             | `JwtAuthGuard`, `RolesGuard`| `citizen` |
| `POST   /api/applications/:id/cancel-old-passport`  | `JwtAuthGuard`, `RolesGuard`| `officer` |

#### `MukhtarController` — confirmed already guarded
Controller-level `@UseGuards(JwtAuthGuard, RolesGuard)` covers both
`GET /api/mukhtar/pending` and `POST /api/mukhtar/applications/:id/reject`;
both methods carry `@Roles('mukhtar')`.

#### `OfficerController` — already guarded
Controller-level guards + `@Roles('officer')` on `GET /api/officer/pending`.

#### `PaymentsController`
| Route | Guards | Notes |
|---|---|---|
| `POST /api/payments/initiate`               | `JwtAuthGuard`, `RolesGuard` (`citizen`) | citizen-only |
| `GET  /api/payments/:applicationId/status`  | `JwtAuthGuard`                            | any authenticated |
| `POST /api/payments/callback`               | **unguarded** | CashPlus webhook — external service has no JWT. Authenticity must be verified via signed-webhook check inside the service (TODO). |

#### `DeliveryController`
| Route | Guards | Notes |
|---|---|---|
| `POST /api/delivery/manifest`               | `JwtAuthGuard`, `RolesGuard` (`officer`)  | officer-only |
| `GET  /api/delivery/:applicationId/status`  | `JwtAuthGuard`                            | any authenticated |
| `POST /api/delivery/callback`               | **unguarded** | LibanPost webhook — same rationale as the payments callback. |

### Auth Flow Fix — sync XHR shim removed

`authService.loginAuthorized` previously used a blocking
`XMLHttpRequest` to preserve a synchronous return type for
`AuthorizedLoginPage.tsx`. It is now `async` and uses `fetch()`. Same
session keys (`npis_token`, `npis_session`) and same `MockUser` return
shape — only the call signature changed.

**One-line `.tsx` change** in `AuthorizedLoginPage.tsx:22`:
```diff
- const user = authService.loginAuthorized(identifier, password);
+ const user = await authService.loginAuthorized(identifier, password);
```
The surrounding `handleSubmit` was already declared `async` and already
wrapped in `try/catch`, so no other lines required modification.

---

## Session 17 — Mukhtar Form & Biometric Persistence

### Branch
`feature/backend-integration` (continuing).

### Schema Touched
- `mukhtar_forms` — `form_data` (jsonb), `signed`, `signed_by`,
  `electronic_signature`, `signed_at`.
- `biometric_data` — `verification_status` (defaults to `'Pending'`).
- Both tables existed already; no migration required.

### Backend Changes (`backend/src/applications/applications.service.ts`)

#### `create()`
After the `INSERT INTO applications ... RETURNING *`:
1. **mukhtar_forms** — `INSERT INTO mukhtar_forms (application_id, form_data) VALUES ($1, $2)`
   using `body.mukhtarFormData ?? {}` serialized as JSONB. Wrapped in
   `try/catch`; a failure logs and does not roll back the application.
2. **biometric_data** — when `body.biometricCaptured === true`:
   `INSERT INTO biometric_data (application_id, verification_status)
   VALUES ($1, 'Pending')`. Same non-fatal pattern.

#### `signApplication()`
After `current_status` UPDATE and `application_status_history` INSERT:
- `UPDATE mukhtar_forms SET signed=true, signed_by=$1, signed_at=NOW(),
  electronic_signature=$2 WHERE application_id=$3` with
  `electronic_signature = 'SIG-<mukhtarId>-<Date.now()>'`. Non-fatal.

#### `applicationSelect` (used by `findAll` / `findOne`)
Added `LEFT JOIN mukhtar_forms mf ON mf.application_id = a.application_id`
and exposed:
- `mf.form_data AS mukhtar_form_data`
- `mf.signed AS mukhtar_signed`
- `mf.signed_at AS mukhtar_signed_at`
- `mf.electronic_signature AS mukhtar_electronic_signature`

### Frontend Changes

#### `services/applicationService.ts` — `createApplication` POST body
Real-mode body now also sends:
```ts
mukhtarFormData: {
  address: application.mukhtarFormData?.address ?? '',
  district: application.mukhtarFormData?.district ?? '',
  mukhtarName: application.mukhtarFormData?.mukhtarName ?? '',
},
biometricCaptured: application.biometricCaptured ?? false,
```

#### `utils/apiAdapters.ts` — `mapApiApplicationToFrontend`
New helper `parseMukhtarFormData` reads the joined `mukhtar_form_data`
JSONB (snake→camel → `mukhtarFormData`) and produces the frontend
shape `{ address, district, mukhtarName }` with empty-string fallbacks.
Replaces the hard-coded empty object that was previously returned.

### Verified
- Backend `tsc --noEmit` clean.
- Frontend `tsc --noEmit` clean.
- Only one `.tsx` file modified (`AuthorizedLoginPage.tsx`, single
  one-line change). All other component files untouched.

### Open Follow-ups
- Webhook signature verification on `/payments/callback` and
  `/delivery/callback` (currently both intentionally unguarded with
  comments explaining why).
- Persist `mukhtar_signed_at` / `mukhtar_electronic_signature` into the
  frontend `PassportApplication` interface so the officer detail panel
  can show signature metadata sourced from the DB instead of localStorage.
- `biometric_data` only records intent (`verification_status = 'Pending'`);
  actual face/fingerprint blobs and ML verification still pending.

---

## Session 18 — Notifications

### Branch
`feature/backend-integration` (continuing).

### Migration
`backend/migrations/003_notifications.sql` — creates `public.notifications`
with `notification_id (uuid PK)`, `user_id (uuid FK → users)`,
`application_id (uuid FK → applications, nullable)`, `message`, `is_read`,
`created_at`. Plus `idx_notifications_user_id` and a `created_at DESC` index.

### Backend
- `NotificationsService` rewritten with real DB queries: `create`,
  `getByUser`, `markAsRead`, `markAllAsRead`, `getUnreadCount`.
- `NotificationsController` routes (all behind `JwtAuthGuard`):
  - `GET    /api/notifications?userId=`
  - `POST   /api/notifications`
  - `PATCH  /api/notifications/:id/read`
  - `PATCH  /api/notifications/read-all`  (body: `{ userId }`)
  - `GET    /api/notifications/unread-count?userId=`
- `NotificationsModule` now imports `DatabaseModule` + `AuthModule` and
  `exports: [NotificationsService]`.
- `ApplicationsModule` imports `NotificationsModule`.

### Server-side notification emission (`ApplicationsService`)
New helpers `getCitizenUserId`, `getMukhtarUserId`, and `notify`
(non-throwing wrapper). Notifications now fire after:
| Transition | Recipient | Message |
|---|---|---|
| `signApplication` → `Mukhtar Signed` | citizen | "Your application has been signed by your Mukhtar and is now under review." |
| `approveApplication` → `Processed for Issuance` | citizen | "Your application has been approved and is being processed for issuance." |
| `requestResubmission` → `Resubmission Required` | citizen | "Your application requires document resubmission. Please check the details." |
| `resubmitDocuments` → `Pending` | assigned mukhtar (if any) | "A citizen has resubmitted documents for your review." |
| `issueApplication` → `Issued` | citizen | "Your passport has been issued and will be delivered soon." |

All notification calls wrapped in `try/catch` — a failure logs and never
fails the parent transaction.

### Frontend
- `notificationService.ts` rewritten. Public methods kept synchronous so
  no `.tsx` changes are required: each read returns whatever is currently
  cached under `localStorage['notifications_<userId>']` and kicks off a
  background `fetch` that refreshes that cache. `markAsRead` and
  `markAllAsRead` update the cache immediately and fire-and-forget the
  PATCH. `create()` is a server-handled no-op when
  `VITE_USE_MOCK_NOTIFICATIONS=false`.
- `frontend/.env.development` → `VITE_USE_MOCK_NOTIFICATIONS=false`.

### Verified
- Backend `tsc --noEmit` clean.
- Frontend `tsc --noEmit` clean.
- No `.tsx` component files modified this session.

---

## Session 19 — Passports + ISSUED Flow

### Branch
`feature/backend-integration` (continuing).

### Migration
`backend/migrations/004_passports.sql`:
- `public.passports` — `passport_id (uuid PK)`, `user_id (uuid FK)`,
  `source_application_id (uuid FK)`, `booklet_number (varchar UNIQUE)`,
  `status ∈ {ACTIVE, CANCELLED}`, `issued_at`, `expires_at (NOT NULL)`,
  `cancelled_at`, `cancelled_by_application_id`.
- `ALTER TABLE applications ADD COLUMN renewing_passport_id UUID
  REFERENCES passports(passport_id)`.
- Indexes `idx_passports_user_id`, `idx_passports_status`.

### Backend — new `passports` module
- `PassportsService`:
  - `createPassport({ userId, sourceApplicationId, bookletNumber, validityYears })`
    — `expires_at = NOW() + (years || ' years')::interval`.
  - `getPassportsByUser(userId)` — ordered by `issued_at DESC`.
  - `cancelPassport(passportId, cancelledByApplicationId)`.
  - `getExpiringPassports(userId)` — ACTIVE passports expiring within
    6 months, ordered by `expires_at ASC`.
- `PassportsController` (all routes behind `JwtAuthGuard`):
  - `POST   /api/passports`
  - `GET    /api/passports?userId=`
  - `GET    /api/passports/expiring?userId=`
  - `PATCH  /api/passports/:id/cancel`  (body: `{ cancelledByApplicationId }`)
- Registered in `app.module.ts` and imported into `ApplicationsModule`
  (no circular dependency — passports doesn't import applications).

### ISSUED endpoint — `POST /api/applications/:id/issue`
Guarded by `JwtAuthGuard, RolesGuard, @Roles('officer')`. Handler
`ApplicationsService.issueApplication(applicationId, officerId, bookletNumber)`:
1. Load `citizen_id`, `validity_id`, `application_type`,
   `renewing_passport_id`, `current_status`.
2. Look up `validity_years` from `passport_validity_options`.
3. Resolve citizen `user_id` via `citizen_profiles`.
4. `passportsService.createPassport(...)`.
5. If `application_type='renewal'` and `renewing_passport_id` set,
   `passportsService.cancelPassport(renewing_passport_id, applicationId)`.
6. `UPDATE applications SET current_status='Issued',
   assigned_officer_id=..., completed_at=NOW()`.
7. `INSERT INTO application_status_history`.
8. Server-side notification: "Your passport has been issued and will
   be delivered soon."
9. LibanPost manifest placeholder — `console.log` with a `// TODO FR-31`.
Returns `{ application, passport, cancelledPassport }`.

### Frontend
- `passportService.ts` — gated behind `VITE_USE_MOCK_PASSPORTS`.
  - `getPassportsByUser`: real-mode hits `GET /api/passports?userId=`
    and maps via `snakeToCamel`.
  - `getExpiringPassports`: real-mode hits
    `GET /api/passports/expiring?userId=`, then applies the existing
    severity / dismissal / renewal-suppression logic on top.
  - `createPassport` and `cancelPassport` are no-ops in real mode
    (server handles both inside `issueApplication`).
- `officerService.issueApplication`: real-mode POSTs to
  `/api/applications/:id/issue` with `{ officerId, bookletNumber }`
  (officerId resolved from `npis_session`); server emits notifications
  and creates the passport.
- `frontend/.env.development` → `VITE_USE_MOCK_PASSPORTS=false`.

### Migrations to run (Supabase SQL Editor, in order)
1. `backend/migrations/003_notifications.sql`
2. `backend/migrations/004_passports.sql`

### Verified
- Backend `tsc --noEmit` clean.
- Frontend `tsc --noEmit` clean.
- No `.tsx` component files modified this session.

### Open Follow-ups
- Backend `notifications` rows have no `type` / `title` columns; the
  frontend maps every message to `STATUS_UPDATE`. If type-coded routing
  is needed, add columns + map in `NotificationsService.create`.
- LibanPost manifest is still a `console.log`; real `POST` to LibanPost
  to be wired alongside FR-31.
- Expiry-banner renewal-suppression still reads applications from
  localStorage in `passportService.getExpiringPassports`. In real mode
  the renewal application lives in Supabase — when that path is moved
  to `apiClient.get('/applications')` we can drop the localStorage scan.

---

## Session 20 - Document Upload via Supabase Storage

### Branch
`feature/backend-integration` (continuing).

### Migration
`backend/migrations/005_document_storage.sql`:
- Creates/updates the existing public Supabase Storage bucket `documents`.
- Allows `application/pdf`, `image/jpeg`, and `image/png`.
- Sets 10 MB file size limit.
- Adds a public read policy for files in the bucket.

Required backend env vars:
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_STORAGE_BUCKET=documents
```
`SUPABASE_STORAGE_BUCKET` is optional; it defaults to `documents`.

### Backend
- Added `DocumentsModule`, `DocumentsController`, `DocumentsService`.
- Registered `DocumentsModule` in `AppModule`.
- New guarded endpoint:
```
POST /api/documents/upload
Content-Type: multipart/form-data
fields:
  file
  applicationId
  documentType: identity_document | passport_photo | old_passport
```
- `DocumentsService.uploadDocument()`:
  1. Validates file presence, document type, and MIME type.
  2. Uploads the file to Supabase Storage using the service role key.
  3. Builds a public object URL.
  4. Updates or inserts the matching `documents` row with `file_url`.

### Application Query Hydration
`ApplicationsService.applicationSelect` now aggregates rows from
`documents` into:
```
documents: {
  identityDocument,
  passportPhoto,
  oldPassport
}
```
where each value is the stored Supabase public URL.

`mapApiApplicationToFrontend()` now maps that object into
`PassportApplication.documents`, replacing the previous hard-coded nulls.

### Frontend
- `apiClient.ts` now has `postForm()` for multipart requests without forcing
  `Content-Type: application/json`.
- Added `documentService.ts`:
  - `uploadDocument(applicationId, field, file)`
  - `uploadDocuments(applicationId, files)`
- `NewPassportApplicationPage.tsx` flow:
  1. Create application first to get the real backend UUID.
  2. Upload selected files to `/api/documents/upload`.
  3. Redirect to payment after uploads finish.
- `DocumentResubmissionPage.tsx` flow:
  1. Upload replacement files to `/api/documents/upload`.
  2. Send uploaded URLs to `POST /api/applications/:id/resubmit`.
  3. Backend resets status to `Pending` and resolves resubmission rows.

### Verified
- Backend app compile: `tsc -p tsconfig.build.json --noEmit` clean.
- Frontend compile: `tsc --noEmit` clean.

### Notes
- The upload UI still shows its existing local progress simulation; the real
  network upload happens on submit once an application UUID exists.
- Document Storage uses public URLs for demo simplicity. A production version
  should switch to private objects plus signed URL generation.

---

## Session 21 - Real-Mode Cleanup & Access Control

### Branch
`feature/backend-integration` (continuing).

### Backend Access-Control Changes

#### 1. `/api/applications` now filters server-side
`ApplicationsController` now passes `request.user` from `JwtAuthGuard` into
`ApplicationsService.findAll()`.

Filtering rules:
- `citizen` sees only applications owned through `citizen_profiles.user_id`.
- `mukhtar` direct application listing is limited to `Verified` applications.
- `officer` direct application listing is limited to staff-relevant statuses:
  `Mukhtar Signed`, `Processed for Issuance`, `Issued`.
- `admin` can list all.

The `role` query is no longer trusted blindly. It is only honored when it
matches the authenticated user's role, or when the user is `admin`. This
prevents a citizen from calling `/api/applications?role=officer` to see an
officer queue.

#### 2. Single-application reads check citizen ownership
`GET /api/applications/:id` and `GET /api/applications/:id/status` now pass
`request.user` into the service. Citizen access is checked through
`citizen_profiles`; a citizen cannot read another citizen's application by UUID.

#### 3. Mutating calls use JWT identity where appropriate
Controller handlers now prefer the authenticated JWT user over caller-supplied
IDs:
- `POST /api/applications` uses `request.user.id` as `citizenId` for citizens.
- `POST /api/applications/:id/sign` uses `request.user.id` as `mukhtarId`.
- `POST /api/applications/:id/approve` and `/issue` use `request.user.id` as
  `officerId`.
- `POST /api/applications/:id/resubmit` uses `request.user.id` as `citizenId`
  and verifies ownership.

#### 4. Document upload ownership check
`POST /api/documents/upload` now passes `request.user` to
`DocumentsService.uploadDocument()`.

The service verifies that the authenticated citizen owns the target
`applicationId` before uploading to Supabase Storage or updating
`documents.file_url`. Admin is allowed; non-citizen staff uploads are rejected
for now because the current UI only supports citizen document submission.

### Frontend Real-Mode Cleanup

#### 1. Expiry banner renewal suppression no longer reads applications from localStorage
`passportService.getExpiringPassports()` now uses real
`GET /api/applications` data when `VITE_USE_MOCK_PASSPORTS=false`. The existing
suppression rule remains the same:
- renewal targets the expiring passport,
- renewal status is active/in-progress,
- payment status is `Paid`.

#### 2. Staff document visibility improved
Mukhtar and Officer detail panels now show an `Open` link when a document value
is a Supabase URL. This makes the Session 20 Storage wiring visible in staff
review flows instead of rendering only a long URL string.

### Verified
- Backend app compile: `tsc -p tsconfig.build.json --noEmit` clean.
- Frontend compile: `tsc --noEmit` clean.

### Notes
- Mukhtar queue filtering is still status-based (`Verified`). District-based
  assignment remains a later enhancement once routing data is authoritative.
- Staff upload is intentionally blocked in `DocumentsService` for now; citizen
  application submission and citizen resubmission are the supported upload
  flows.
