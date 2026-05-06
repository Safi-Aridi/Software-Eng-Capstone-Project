# Phase 9 — Mukhtar & GS Officer Dashboards (Build)

## Context
Read `ProjectSummary.md` first for full project context. Note: Session 4's claim that the Mukhtar and Officer dashboards are functional is INCORRECT. The current state is:
- `MukhtarDashboard.tsx` exists but is a static, non-interactive screen
- `OfficerDashboard.tsx` may not exist or is similarly non-functional
- The supporting services (`mukhtarService.ts`, `officerService.ts`) exist with stub functions but are not wired to the UI

The citizen portal is fully complete (Session 8). This phase builds the staff side end-to-end so the full workflow (citizen submits → Mukhtar signs → Officer approves) becomes demonstrable.

Read the SRS document (`SRS_Document__Passport_Issuance_Platform.pdf`) sections FR-12 through FR-19 and Tables 7 & 8 for the exact functional requirements driving this work.

## Goal
Build fully functional Mukhtar and GS Officer dashboards that mirror the polish and patterns of the existing Citizen portal. All data continues to flow through the existing service layer (no direct localStorage in components). All status changes must trigger appropriate notifications to the citizen so the end-to-end loop demonstrates correctly.

## Pre-Work — Read Before Coding

1. **Existing patterns to mirror**: read `CitizenDashboard.tsx`, `ApplicationStatusPage.tsx`, and `DocumentResubmissionPage.tsx` to match the styling, card layouts, modal patterns, toast notifications, and loading states already used citizen-side. Do not invent new patterns.
2. **Service layer**: read `mukhtarService.ts`, `officerService.ts`, `applicationService.ts`, `notificationService.ts`. Note which functions are stubbed and which are missing. Extend rather than rewrite.
3. **Auth & routing**: read `AuthorizedLoginPage.tsx`, `App.tsx` (route protection), and `authService.ts` to understand how role-based session and ProtectedRoute work.
4. **Dev tooling**: read `DevStatusPanel.tsx` — this is how we seed test data during development. Confirm it can mark applications as VERIFIED and MUKHTAR_SIGNED so the queues populate.
5. **Test users already seeded** (per `seedTestData.ts`): `mukhtar@test.com` / `test123` (role: mukhtar) and `officer@test.com` / `test123` (role: officer). Do not re-seed these.

## Scope — What to Build

### 1. Mukhtar Dashboard (`src/pages/MukhtarDashboard.tsx`)

**Header**
- App logo/title, logged-in mukhtar name, logout button
- Match the citizen dashboard header style

**Queue (FR-13)**
- Calls `mukhtarService.getPendingApplications()` on mount
- Filter: `currentStatus === 'VERIFIED'`
- Empty state: friendly message ("No applications awaiting review") with note about Dev Status Panel for testing
- Loading state: skeleton cards or spinner
- Each card displays: tracking number, applicant full name, application type (NEW / RENEWAL), submission date, district, mukhtar form name field
- Cards are clickable — opens detail drawer

**Detail Drawer (FR-14)**
- Slide-in panel from right (or modal on smaller screens)
- Shows: full citizen data (name, address, district, mukhtar name from form), application type, validity, document thumbnails for identity doc, passport photo, and old passport (renewal only — render the actual base64 or URL stored)
- Two action buttons at the bottom: "Approve & Sign" (primary, green) and "Request Resubmission" (secondary, amber)
- Close button (X) in top right

**Approve & Sign Flow (FR-15, FR-16)**
- Confirmation modal: "Apply your electronic signature to this application?"
- On confirm, call `mukhtarService.signApplication(applicationId)`
- The service must:
  - Update `currentStatus` → `MUKHTAR_SIGNED`
  - Store mock signature: `mukhtar_signature_<applicationId>` with `{ mukhtarId, mukhtarName, signedAt }`
  - **Create a notification for the citizen** via `notificationService.create()` — message: "Your application <tracking> has been signed by your Mukhtar and is being processed by General Security." Mark with `// TODO: Remove when backend is connected — NestJS handles notification creation server-side`
  - Simulate 5% random failure (`Math.random() < 0.05`) — return `{ success: false, error: 'cryptographic signature generation failed' }` and DO NOT update state on failure
- On success: green toast ("Application signed successfully"), drawer closes, queue refreshes
- On failure: red toast with error message, drawer stays open, no state change
- Loading state on the button during the 1–2 second simulated signing delay

**Request Resubmission Flow (FR-22 from Mukhtar trigger)**
- Modal with a form letting the Mukhtar select which documents need resubmission and provide a reason for each
- Document checkboxes: Identity Document, Passport Photo, Old Passport (renewal only)
- For each checked document, a textarea for the rejection reason
- "Submit" button calls `mukhtarService.requestResubmission(applicationId, resubmissionReasons)`
- The service must:
  - Update `currentStatus` → `RESUBMISSION_REQUIRED`
  - Populate the application's `resubmissionReasons` field with the structure DocumentResubmissionPage expects (see existing usage in `DevStatusPanel.tsx` for the seeded shape — match it exactly)
  - **Create a notification for the citizen** (FR-23) — message: "Action required: Your Mukhtar has requested document resubmission for application <tracking>." Same TODO comment.
- On success: amber toast ("Resubmission request sent"), drawer closes, queue refreshes (the application disappears from VERIFIED filter)

### 2. GS Officer Dashboard (`src/pages/OfficerDashboard.tsx`)

**Header** — same pattern, "GS Officer" role indicator

**Queue (FR-17, FR-18)**
- Calls `officerService.getPendingApplications()` on mount
- Filter: `currentStatus === 'MUKHTAR_SIGNED'`
- Same card layout as Mukhtar; additionally show a "Mukhtar Signed" badge with the signing timestamp from `mukhtar_signature_<applicationId>`
- Empty state, loading state — same patterns

**Detail Panel**
- Same drawer pattern as Mukhtar
- Shows: full application data, all documents, biometric capture indicator (✓ Captured / N/A for renewals), Mukhtar signature timestamp and Mukhtar name
- Single action button: "Final Approval"

**Final Approval Flow (FR-18)**
- For NEW applications:
  - Single confirmation modal: "Approve this application for issuance?"
  - On confirm, call `officerService.approveApplication(applicationId)`
  - Service updates `currentStatus` → `PROCESSED`, creates citizen notification ("Your passport application <tracking> has been approved and is being processed for issuance.")
- For RENEWAL applications (FR-19):
  - First modal: "Approve this application for issuance?" → on confirm, second modal appears
  - Second modal: "Confirm physical destruction of the old passport booklet (MRZ: <last 6 chars of tracking>). This action cannot be undone."
  - On confirm, call `officerService.approveApplication(applicationId)` AND `officerService.cancelOldPassport(applicationId)`
  - Service updates `currentStatus` → `PROCESSED`, writes `cancelled_passport_<applicationId>` with `{ officerId, officerName, cancelledAt, mrzReference }`, creates TWO citizen notifications (or one combined message — pick one and stick with it; combined message preferred for clarity: "Your passport renewal <tracking> has been approved. Your previous passport has been officially cancelled in the registry.")
- Loading state, success/failure toasts as before
- Modal cancel buttons must clearly back out without state change

### 3. Service Layer Updates

`mukhtarService.ts`:
- `getPendingApplications(): Promise<PassportApplication[]>` — returns all apps with `currentStatus === 'VERIFIED'`
- `signApplication(applicationId): Promise<{success, error?}>` — full implementation per spec above
- `requestResubmission(applicationId, resubmissionReasons): Promise<{success}>` — full implementation per spec above
- All functions `async`, all writes go through `applicationService` mutators where status changes are involved (do not write `currentStatus` directly from `mukhtarService` if `applicationService` already has an `updateStatus` helper — reuse it)
- TODO markers at the top of each function for the future API endpoint

`officerService.ts`:
- `getPendingApplications(): Promise<PassportApplication[]>` — returns all apps with `currentStatus === 'MUKHTAR_SIGNED'`
- `approveApplication(applicationId): Promise<{success}>` — full implementation
- `cancelOldPassport(applicationId): Promise<{success}>` — full implementation
- Same conventions as above

`notificationService.ts`:
- Confirm `create(userId, message, type)` exists. If not, add it. Notification structure should match what the citizen Notification Center already reads (check `CitizenDashboard.tsx` for the read shape).

### 4. Routing & Login

- Confirm `AuthorizedLoginPage.tsx` routes `mukhtar` role → `/mukhtar/dashboard`, `officer` role → `/officer/dashboard`. Fix if broken.
- Confirm `App.tsx` has both routes wrapped in `ProtectedRoute` with the correct role check. Add if missing.
- Confirm citizens cannot reach these routes and staff cannot reach `/citizen/dashboard`.

### 5. Dev Status Panel — Verify, Don't Rebuild

- Confirm the Dev Status Panel can set an application to VERIFIED (so it appears in the Mukhtar queue) and to MUKHTAR_SIGNED (so it appears in the Officer queue). It already does this per Session 7 — just verify it works after your changes. Do not modify the panel unless something is broken.

## Constraints

- **No direct localStorage access in components.** All reads and writes go through services. This is a hard rule from the project's architecture (Backend Note #4).
- **Match existing visual style.** Use the same Tailwind utility patterns, color palette, card styles, and spacing as the citizen portal. Do not introduce new design tokens.
- **All service functions are `async` and return Promises** even though localStorage is sync. Components must `await` (Backend Note #2).
- **Mark every mock-only piece** with `// TODO: ...` comments so backend integration is straightforward. Particular attention to: notification side-effects (Backend Note #1), the 5% random failure simulation (Backend Note #9), the mock signature generation, the mock passport cancellation record.
- **Single Router instance** — do not introduce nested Routers (Session 6 fix).
- **No `beforeunload` or `unload` event listeners** (Session 6 fix).
- **Toasts auto-dismiss after 3 seconds** to match existing convention.
- **Confirmation modals are dismissible** — clicking outside or pressing Escape should cancel without state change.

## Deliverable Order

Build in this order so each step is testable:

1. Service layer first (`mukhtarService.ts`, `officerService.ts`, any `notificationService.ts` additions) — get all functions working with mock data, console-log the side-effects to verify them
2. Mukhtar Dashboard — queue + detail drawer + approve/sign + resubmission
3. Officer Dashboard — queue + detail panel + final approval (NEW path)
4. Officer Dashboard — renewal path with old passport cancellation
5. Routing/login verification
6. End-to-end smoke test using the test plan in section below

## Smoke Test (Run After Build)

After building, walk through this scenario yourself in the browser and report results:

1. Log in as citizen `accepted@test.com` / `test123`
2. Submit a new application (or use an existing one in the seeded data)
3. Open Dev Status Panel, set that application to `VERIFIED`
4. Log out, log in as `mukhtar@test.com` / `test123`
5. Confirm the application appears in the queue
6. Open the detail drawer — confirm all citizen data renders
7. Click "Approve & Sign", confirm modal, approve
8. Confirm toast, queue refresh, application gone from queue
9. Log out, log in as the same citizen
10. Open notification bell — confirm a "Mukhtar signed" notification exists
11. Open the application's status page — confirm timeline shows MUKHTAR_SIGNED stage
12. Log out, log in as `officer@test.com` / `test123`
13. Confirm the application now appears in the Officer queue
14. Click "Final Approval", confirm
15. Confirm status becomes PROCESSED, citizen receives notification
16. Repeat steps 1–15 with a RENEWAL application — confirm the old-passport cancellation modal appears for the officer, confirm `cancelled_passport_*` key is written, confirm citizen notification mentions cancellation
17. Bonus: trigger the resubmission flow from Mukhtar — confirm citizen sees the yellow banner on dashboard, the rejection reasons render on DocumentResubmissionPage, and resubmitting puts the app back into the workflow

Report any failure with: which step, what was expected, what happened, which file you suspect.

## What NOT to Build

- Do not build the application receipt download (Phase 10)
- Do not build the passport expiry reminder (Phase 10)
- Do not start backend integration (Phase 11+)
- Do not modify citizen-side code unless a citizen-side bug is blocking the smoke test (in which case, ask before changing)
- Do not modify the Dev Status Panel beyond verifying it works