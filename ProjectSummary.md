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

*Last updated: Session 12 — Frontend–Backend Integration Layer*

---

## Session 12 — Frontend–Backend Integration Layer

### Branch: `feature/backend-integration`

### Context:
The backend (NestJS, raw PostgreSQL via `pg`, Supabase-hosted) was merged from `nestjs-backend-foundation`. This session wired the frontend service layer to real API calls while keeping all existing mock logic intact behind environment flags. No component files were modified.

---

### What Was Wired (Live API Calls)

| Domain | Env Flag | Endpoints Wired |
|---|---|---|
| Applications | `VITE_USE_MOCK_APPLICATIONS=false` | `GET /api/applications`, `GET /api/applications/:id`, `POST /api/applications`, `PUT /api/applications/:id` |
| Mukhtar queue | `VITE_USE_MOCK_MUKHTAR=false` | `GET /api/mukhtar/pending`, `POST /api/applications/:id/sign` |
| Officer queue | `VITE_USE_MOCK_OFFICER=false` | `GET /api/officer/pending`, `POST /api/applications/:id/approve` |

### What Stays Mocked (and Why)

| Domain | Env Flag | Reason |
|---|---|---|
| Auth | `VITE_USE_MOCK_AUTH=true` | Backend `auth.service.ts` is a stub — no users table, no password check. Requires a real `users` table + `bcrypt` before wiring. |
| Payments | `VITE_USE_MOCK_PAYMENTS=true` | `POST /api/payments/initiate` is a stub. Real CashPlus integration not yet built. |
| Notifications | `VITE_USE_MOCK_NOTIFICATIONS=true` | Backend notification endpoint has no user filtering — returns hardcoded demo data. |
| KYC | `VITE_USE_MOCK_KYC=true` | All three KYC endpoints (`submit`, `status`, `resubmit`) are stubs with no DB interaction. |
| Passports | `VITE_USE_MOCK_PASSPORTS=true` | No `passports` table in the backend schema yet. |
| Officer issuance (Tab 2) | Always mocked | No backend endpoint for `PROCESSED → ISSUED` transition or passport creation. `issueApplication` and `cancelOldPassport` remain localStorage-only. |

---

### New Files Created

#### `frontend/.env.development`
Vite environment file consumed at build time. Sets `VITE_API_BASE_URL=http://localhost:5000/api` and all mock flags. Never committed with real secrets — only flag values and the local API URL.

#### `frontend/src/utils/apiAdapters.ts`
Stateless pure-function adapter utilities isolating all data-shape translation from service logic. Components are untouched.

**Functions exported:**

| Function | Purpose |
|---|---|
| `snakeToCamel(obj)` | Recursively converts snake_case keys to camelCase on any object/array tree |
| `backendStatusToFrontend(s)` | Maps backend Title-Case-with-spaces status strings to frontend SCREAMING_SNAKE_CASE |
| `frontendStatusToBackend(s)` | Reverse of above |
| `backendPaymentStatusToFrontend(s)` | `'Pending'→'UNPAID'`, `'Paid'→'Paid'`, `'Failed'→'Failed'` |
| `frontendPaymentStatusToBackend(s)` | Reverse of above |
| `backendAppTypeToFrontend(s)` | `'new_passport'→'NEW'`, `'renewal'→'RENEWAL'` |
| `frontendAppTypeToBackend(s)` | Reverse of above |
| `mapApiApplicationToFrontend(raw)` | Runs `snakeToCamel`, renames `citizenId→userId`, applies all status/type mappers, fills frontend-only fields (`passportValidity:5`, `feeAmount:0`, `documents:null`, `biometricCaptured:false`, etc.) with safe defaults |

**Status mapping table:**

| Backend (DB) | Frontend |
|---|---|
| `'Pending'` | `'PENDING_REVIEW'` |
| `'Verified'` | `'VERIFIED'` |
| `'Mukhtar Signed'` | `'MUKHTAR_SIGNED'` |
| `'Processed for Issuance'` | `'PROCESSED'` |
| `'Issued'` | `'ISSUED'` |
| `'Resubmission Required'` | `'RESUBMISSION_REQUIRED'` |
| `'Delivered'` | `'DELIVERED'` |
| `'Delivery Failed - Branch Collection Required'` | `'DELIVERED'` |

#### `backend/seed.sql`
SQL file for populating the Supabase database with reproducible test data. Not executed automatically — must be run manually against the database.

**How to run:**
```bash
psql "$DATABASE_URL" -f backend/seed.sql
```
Or paste into the Supabase SQL editor.

**What it seeds:**
- `passport_validity_options`: rows for 5-year (id=1, fee=200.00) and 10-year (id=2, fee=350.00)
- 3 applications under citizen UUID `a1b2c3d4-0000-0000-0000-000000000001`:
  - `TRK-TEST-001`: `new_passport`, `Mukhtar Signed`, payment `Paid` — visible in Officer Tab 1
  - `TRK-TEST-002`: `renewal`, `Pending`, payment `Pending` — visible in citizen dashboard
  - `TRK-TEST-003`: `new_passport`, `Pending`, payment `Failed` — tests failed-payment display
- Documents for each application (`identity_document`, `passport_photo`; plus `old_passport` for renewal)
- Mukhtar form for App 1 (Hamra St, Beirut, Khalil Raad) — signed=true
- One status history row per application
- All inserts use `ON CONFLICT DO NOTHING` — safe to re-run

---

### Files Modified

#### `frontend/src/services/apiClient.ts`
- Base URL now reads `VITE_API_BASE_URL`, falls back to `http://localhost:5000/api` (was `:3000`)
- Token read from `localStorage.getItem('npis_token')` (was reading inside `npis_user` JSON)
- 401 handler: clears `npis_token` and `npis_session`, then redirects to `/`
- `ApiError` class updated: now carries `status: number` (was `statusCode`)
- `patch()` method retained for future use

#### `frontend/src/services/applicationService.ts`
- Added `const USE_MOCK = import.meta.env.VITE_USE_MOCK_APPLICATIONS === 'true'`
- Added imports: `apiClient`, `mapApiApplicationToFrontend`, `frontendAppTypeToBackend`, `frontendStatusToBackend`
- `getApplications(userId)` — mock: unchanged localStorage scan; live: `GET /api/applications` + client-side filter by `citizenId`
- `getApplicationById(userId, id)` — mock: unchanged; live: `GET /api/applications/:id`
- `createApplication(userId, application)` — mock: unchanged; live: `POST /api/applications` with `{ citizenId, applicationType, validityId }`
- `updateApplicationStatus(id, status)` — new function; mock: scans localStorage; live: `PUT /api/applications/:id`
- All other functions (`updateApplicationDocuments`, `getApplicationStatus`, `saveApplication`, `updateApplication`, `generateTrackingNumber`) unchanged

#### `frontend/src/services/mukhtarService.ts`
- Added `const USE_MOCK = import.meta.env.VITE_USE_MOCK_MUKHTAR === 'true'`
- Added imports: `apiClient`, `mapApiApplicationToFrontend`
- `getPendingApplicationsFull()` — mock: unchanged; live: `GET /api/mukhtar/pending`, maps to `EnrichedApplication[]` with `citizenIdentity: null`
- `signApplication()` — mock: unchanged (signature generation + localStorage update + notification); live: `POST /api/applications/:id/sign` + notification side-effect retained with TODO marker
- `rejectApplication()`, `requestResubmission()`, `getStoredSignature()`, `getSignatureMetadata()` — unchanged (mock only)

#### `frontend/src/services/officerService.ts`
- Added `const USE_MOCK = import.meta.env.VITE_USE_MOCK_OFFICER === 'true'`
- Added imports: `apiClient`, `mapApiApplicationToFrontend`
- `getProcessingQueueFull()` — mock: unchanged; live: `GET /api/officer/pending`, maps to `EnrichedApplication[]` with `citizenIdentity: null`
- `approveApplication()` — mock: unchanged; live: `POST /api/applications/:id/approve` + notification side-effect retained with TODO marker
- `getIssuanceQueueFull()`, `issueApplication()`, `cancelOldPassport()` — always mocked (issuance flow has no backend endpoint yet); explicit comments added

---

### Backend Fixes Required Before Auth Can Be Wired

The following backend changes are needed before `VITE_USE_MOCK_AUTH` can be set to `false`:

1. **`users` table** — No users table exists in the backend. Create it with at minimum: `user_id UUID PK`, `email TEXT UNIQUE`, `mobile_number TEXT UNIQUE`, `password_hash TEXT`, `role TEXT`, `account_status TEXT`, `created_at TIMESTAMP`.

2. **Password hashing** — Install `bcrypt` (or `argon2`). Hash passwords on `register`, compare on `login`. Never store plaintext.

3. **Real `register` endpoint** — Current implementation returns `{ success: true, receivedData: body }` with no DB write. Must `INSERT INTO users` and return a JWT.

4. **Real `login` endpoint** — Current implementation mints a JWT from whatever `body.role` is passed (no credential check). Must look up user by email/mobile, verify password hash, return `{ token, user: { id, email, role, accountStatus } }`.

5. **`accountStatus` on JWT or `/me` response** — The frontend session stores `accountStatus` (one of `NO_IDENTITY_VERIFICATION | PENDING_IDENTITY_VERIFICATION | IDENTITY_VERIFICATION_REJECTED | ACTIVE | LOCKED`). The backend must return this field on login and `/me` so the frontend can route correctly after authentication.

6. **Account lockout** — FR-05.1: lock after 3 failed attempts, auto-unlock after 15 minutes. This logic currently lives entirely in `authService.ts` (frontend). The backend `users` table needs `failed_login_attempts INT` and `locked_at TIMESTAMP` columns, and the login endpoint must enforce the lock.

7. **Session key alignment** — The frontend stores the JWT under `localStorage.key('npis_token')` and the full session object under `npis_session`. Confirm `authService.ts` is updated to write to these keys (currently writes `npis_user`) before toggling the auth flag.

---

### Environment Flag Reference

| Flag | Current Value | Effect when `true` | Effect when `false` |
|---|---|---|---|
| `VITE_USE_MOCK_AUTH` | `true` | localStorage mock login/register | Real `POST /api/auth/login` and `/register` |
| `VITE_USE_MOCK_APPLICATIONS` | `false` | localStorage CRUD | Real `GET/POST/PUT /api/applications` |
| `VITE_USE_MOCK_MUKHTAR` | `false` | localStorage scan | Real `GET /api/mukhtar/pending` + sign endpoint |
| `VITE_USE_MOCK_OFFICER` | `false` | localStorage scan | Real `GET /api/officer/pending` + approve endpoint |
| `VITE_USE_MOCK_PAYMENTS` | `true` | Simulated CashPlus callback | Real `POST /api/payments/initiate` |
| `VITE_USE_MOCK_NOTIFICATIONS` | `true` | Per-user localStorage notifications | Real `GET /api/notifications` (requires user filtering in backend first) |
| `VITE_USE_MOCK_KYC` | `true` | KYC status in localStorage | Real `/api/kyc/*` (requires backend implementation first) |
| `VITE_USE_MOCK_PASSPORTS` | `true` | Passport records in localStorage | Real `/api/passports/*` (requires passports table in backend first) |
