# Phase 11 — Passport Entity, ISSUED State & Expiry Banner Wiring

## Context
Read `ProjectSummary.md` first for full project context. Sessions 1–10
are complete. This phase introduces a foundational data model addition
(the Passport entity) and a new application status (ISSUED) that together
fix the expiry banner's data source and complete the GS Officer workflow
into a realistic two-stage action.

Read the SRS sections FR-17 through FR-19, FR-31, FR-33, and section 3.1
(database entities) before starting. Note that ISSUED is a deliberate
extension of the SRS state machine — it is not defined in FR-18 but is
justified by real-world accuracy. The LibanPost manifest trigger (FR-31)
moves from PROCESSED to ISSUED as part of this change.

## Architectural Decisions Locked In

These are not open for interpretation — implement exactly as specified:

1. **Passport record created at ISSUED** by the GS Officer, who manually
   enters the booklet number. All other fields are derived automatically.
2. **Expiry computed automatically** as issuedAt + passportValidity years
   from the source application. Officer does not enter it.
3. **Old passport cancelled at ISSUED** for renewal applications —
   simultaneously with new passport creation in the same Officer action.
   Not at PROCESSED, not at DELIVERED.
4. **LibanPost manifest trigger moves from PROCESSED to ISSUED.**
   Currently FR-31 fires at PROCESSED — update all references.
5. **DELIVERED is terminal and automated** — triggered by LibanPost
   callback (currently mocked via Dev Status Panel). No Officer action
   at DELIVERED.
6. **Expiry banner reads from Passport records**, not application
   records. The banner logic introduced in Session 10 must be
   re-wired to use passportService instead of applicationService
   delivered-date computation.

## Updated Application State Machine
PENDING_REVIEW → VERIFIED → MUKHTAR_SIGNED → PROCESSED → ISSUED → DELIVERED

| Status | Triggered By | Side Effects |
|---|---|---|
| PENDING_REVIEW | Citizen submits | Payment initiated |
| VERIFIED | ML system (Dev Panel) | Routed to Mukhtar queue |
| MUKHTAR_SIGNED | Mukhtar signs | Citizen notified, routed to Officer queue |
| PROCESSED | GS Officer (first action) | Application approved for printing |
| ISSUED | GS Officer (second action) | Passport record created, old passport cancelled (renewal), LibanPost manifest sent, citizen notified |
| DELIVERED | LibanPost callback (Dev Panel) | Application closed, citizen notified |

## Pre-Work — Read Before Coding

1. `src/services/applicationService.ts` — PassportApplication interface,
   updateStatus, existing status values
2. `src/pages/OfficerDashboard.tsx` — existing Officer queue and approval
   flow built in Session 9
3. `src/pages/ApplicationStatusPage.tsx` — status timeline rendering
4. `src/components/DevStatusPanel.tsx` — status override buttons and
   side-effect seeding
5. `src/utils/seedTestData.ts` — safe-seed pattern
6. `src/services/notificationService.ts` — create() signature
7. `src/pages/CitizenDashboard.tsx` — existing expiry banner logic from
   Session 10 that needs re-wiring

## Part 1 — Passport Entity & Service

### Interface (`src/types/passport.ts` — new file)

```typescript
interface Passport {
  passportId: string           // generated: LBPP-<8 digits>
  userId: string               // citizen who owns this passport
  sourceApplicationId: string  // application that produced this passport
  bookletNumber: string        // entered by Officer: format LB-<7 digits>
  status: 'ACTIVE' | 'CANCELLED'
  issuedAt: string             // ISO timestamp — when Officer marks ISSUED
  expiresAt: string            // computed: issuedAt + passportValidity years
  cancelledAt: string | null
  cancelledByApplicationId: string | null  // renewal app that cancelled it
}
```

### Service (`src/services/passportService.ts` — new file)

Implement all functions as async. Store passport records under
localStorage key `passports_<userId>` as an array. No direct
localStorage access from components.

Functions required:

- `createPassport(userId, sourceApplicationId, bookletNumber):
  Promise<Passport>`
  - Derives issuedAt (now), expiresAt (issuedAt + passportValidity
    from the source application), passportId (generated)
  - Saves to localStorage
  - TODO: POST /api/passports

- `getPassportsByUser(userId): Promise<Passport[]>`
  - Returns all passport records for a citizen
  - TODO: GET /api/passports?userId=

- `getActivePassport(userId): Promise<Passport | null>`
  - Returns the single ACTIVE passport for a citizen, or null
  - TODO: GET /api/passports/active?userId=

- `cancelPassport(passportId, cancelledByApplicationId):
  Promise<void>`
  - Sets status → CANCELLED, writes cancelledAt and
    cancelledByApplicationId
  - TODO: PATCH /api/passports/:id/cancel

- `getExpiringPassports(userId): Promise<ExpiringPassport[]>`
  - Replaces the version in applicationService.ts from Session 10
  - Returns only ACTIVE passports where expiresAt is within 6 months
    of today
  - Computes severity: 'info' (6–3 months) | 'warning' (3–1 month) |
    'critical' (<1 month) | 'expired' (past expiresAt)
  - Filters out passports that have an active renewal application
    (see suppression logic below)
  - TODO: GET /api/passports/expiring?userId=

- `dismissExpiryBanner(passportId): Promise<void>`
  - Moves from applicationService.ts (Session 10 version) to here
  - Writes `expiry_banner_dismissed_<passportId>` with timestamp
    and current severity — clears if severity has escalated since
    dismissal
  - TODO: POST /api/passports/:id/dismiss-expiry-banner

### Renewal Suppression Logic (inside getExpiringPassports)

A passport's expiry banner is suppressed when ALL of these are true:
- A renewal application exists with `renewingPassportId === passportId`
- That renewal's `currentStatus` is one of: PENDING_REVIEW, VERIFIED,
  MUKHTAR_SIGNED, PROCESSED, ISSUED
- That renewal's `paymentStatus` is 'Paid'

The banner reappears (not suppressed) when:
- No renewal application references this passport
- The renewal's currentStatus is RESUBMISSION_REQUIRED
- The renewal's paymentStatus is UNPAID or Failed (payment never
  completed — application is stalled)

## Part 2 — PassportApplication Interface Update

In `src/services/applicationService.ts`, add to PassportApplication:

```typescript
renewingPassportId: string | null  
// For RENEWAL applications: passportId of the passport being renewed.
// Populated when citizen arrives via ?fromExpiry=<applicationId> 
// (resolve applicationId → passportId at creation time).
// Null for NEW applications and renewals started without expiry banner.
```

Add `'ISSUED'` to the currentStatus union type:
```typescript
currentStatus: 'PENDING_REVIEW' | 'VERIFIED' | 'MUKHTAR_SIGNED' |
               'PROCESSED' | 'ISSUED' | 'RESUBMISSION_REQUIRED' |
               'DELIVERED'
```

Update the estimated completion time mock logic (FR-11) in
`ApplicationStatusPage.tsx`:

| Status | Estimate |
|---|---|
| PENDING_REVIEW | 5–7 business days |
| VERIFIED | 3–5 business days |
| MUKHTAR_SIGNED | 2–3 business days |
| PROCESSED | 1–2 business days |
| ISSUED | Passport issued — awaiting delivery |
| DELIVERED | Completed |
| RESUBMISSION_REQUIRED | On hold — awaiting resubmission |

## Part 3 — GS Officer Dashboard Updates

The Officer now has TWO distinct queues and TWO distinct actions.
Restructure `OfficerDashboard.tsx` accordingly.

### Queue 1 — Pending Final Approval (existing, minor update)
- Filter: `currentStatus === 'MUKHTAR_SIGNED'`
- Action: "Approve for Issuance" (rename from "Final Approval" to
  clarify this is not the last step)
- On confirm: `currentStatus` → `PROCESSED`
- No passport data entry here
- No old passport cancellation here
- Citizen notification: "Your application <tracking> has been
  approved and sent for passport printing."
- For RENEWAL: no cancellation modal at this stage — remove it
  (it moved to ISSUED)

### Queue 2 — Pending Issuance (new)
- Filter: `currentStatus === 'PROCESSED'`
- Tab or section label: "Ready for Issuance"
- Each card shows: tracking number, applicant name, type, date
  approved (when PROCESSED was set)
- Click opens detail panel

### Issuance Detail Panel (new)
Shows full application data plus a booklet number entry form:
New Passport Booklet Number: [ LB- ___ ___ ___ ___ ___ ___ ___ ]

- Input validation: format LB-XXXXXXX (2 letters, dash, 7 digits).
  Show inline error if format is wrong.
- For RENEWAL applications: show a warning box:
  "Issuing this passport will immediately cancel passport
  <old booklet number or 'on file'>. This cannot be undone."
- "Issue Passport & Send for Delivery" button (primary)

### Issue Passport Action (new)
On confirm:

1. Call `passportService.createPassport(userId, applicationId,
   bookletNumber)` → creates new ACTIVE passport record
2. For RENEWAL only: call `passportService.cancelPassport(
   renewingPassportId, applicationId)` → cancels old passport
3. Update `currentStatus` → `ISSUED`
4. Mock LibanPost manifest transmission (FR-31):
   log `console.log('LibanPost manifest sent:', { trackingNumber,
   bookletNumber, citizenAddress })` — mark with
   `// TODO: POST to LibanPost API endpoint (FR-31)`
5. Create citizen notification: "Your new passport (booklet:
   <bookletNumber>) has been issued and handed to LibanPost for
   delivery. Your old passport has been cancelled." (renewal) or
   "Your new passport (booklet: <bookletNumber>) has been issued
   and handed to LibanPost for delivery." (new)
6. Application disappears from Queue 2, success toast

### Dashboard Layout
Use tabs or clearly separated sections for the two queues.
Show count badges on each tab/section header.
Suggested layout: two-tab structure at the top of the dashboard —
"Pending Approval" (MUKHTAR_SIGNED count) and "Ready for Issuance"
(PROCESSED count).

## Part 4 — Application Status Timeline Update

In `ApplicationStatusPage.tsx`, add ISSUED as a stage in the
timeline between PROCESSED and DELIVERED:

Timeline stages in order:
1. Application Submitted
2. Documents Under Review
3. Verified by System
4. Mukhtar Signed
5. Approved for Printing
6. Passport Issued
7. Delivered

Update stage labels to match — "Processed for Issuance" becomes
"Approved for Printing", new stage "Passport Issued" added.
Visual treatment same as existing (green filled = complete, blue
pulsing = current, gray dashed = pending).

## Part 5 — NewPassportApplicationPage Update

When the form is submitted and `fromExpiry` param is present:
- Resolve `fromExpiry` (which is an applicationId) to its
  corresponding passportId via `passportService.getPassportsByUser()`
  filtering by `sourceApplicationId === fromExpiry`
- Set `renewingPassportId` on the new renewal application record
- If no passport record is found for that applicationId (e.g., old
  seeded data without passport records), set `renewingPassportId`
  to null and proceed — non-blocking

For renewals started without the expiry banner (`fromExpiry` absent):
- `renewingPassportId` remains null
- Banner suppression will not apply — acceptable v1 limitation,
  flag with a comment

## Part 6 — CitizenDashboard Expiry Banner Re-Wire

The expiry banner introduced in Session 10 currently reads from
`applicationService.getExpiringPassports()` which was based on
application `deliveredDate`. Replace entirely:

- Call `passportService.getExpiringPassports(userId)` instead
- Remove `getExpiringPassports()` and `dismissExpiryBanner()` from
  `applicationService.ts`
- The banner component logic stays the same (severity tiers, dismiss,
  "Renew Now" routing) — only the data source changes
- "Renew Now" button already passes `fromExpiry=<applicationId>` —
  update to pass `fromExpiry=<sourceApplicationId>` from the passport
  record (which is the applicationId that produced that passport,
  needed to resolve renewingPassportId at form submission)

## Part 7 — Dev Status Panel Updates

Add to `DevStatusPanel.tsx`:

- **ISSUED override**: when setting status to ISSUED, prompt for a
  booklet number (pre-fill with generated `LB-<7 random digits>`)
  and call `passportService.createPassport()` + cancel old passport
  for renewals. Same side-effects as the real Officer flow.
- **DELIVERED override**: no passport creation here (moved to ISSUED).
  If no passport record exists for this application yet (e.g., dev
  jumped straight to DELIVERED), auto-create one with a generated
  booklet number and log a warning.
- **PROCESSED override**: no passport creation, no cancellation.
  Clean — just status update.

Remove the `deliveredDate` override added in Session 10 — it's
no longer needed since expiry comes from the passport record's
`issuedAt`, which is set at ISSUED.

## Part 8 — Seed Data Updates

In `seedTestData.ts`, add passport records for existing DELIVERED
test applications (Sara Mansour's three near-expiry applications
seeded in Session 10). Generate realistic booklet numbers and
set `issuedAt` to match the dates that produce the three severity
tiers. Safe-seed pattern — only if passport record doesn't already
exist for that applicationId.

Remove the `deliveredDate` field from those seeded applications
if it was added in Session 10 — expiry now derives from the
passport record.

## Constraints

- No direct localStorage in components. All passport reads/writes
  via passportService.
- All service functions async, all callers await.
- Match existing visual patterns for the new Officer tab layout,
  detail panel, and input form.
- Every new mock-only piece marked with TODO for backend integration.
- Single Router instance, no beforeunload listeners.
- Do not touch Mukhtar Dashboard.
- Do not touch citizen application form beyond the
  renewingPassportId wiring in Part 5.
- Do not start backend integration.

## Smoke Test (Run After Build)

**New Passport — Full Flow:**
1. Log in as citizen, submit NEW application, complete payment
2. Dev Panel: VERIFIED → MUKHTAR_SIGNED → PROCESSED
3. Log in as Officer → "Pending Approval" tab → approve →
   status becomes PROCESSED, citizen notified
4. Officer → "Ready for Issuance" tab → enter booklet number
   LB-1234567 → "Issue Passport & Send for Delivery"
5. Confirm: passport record created in localStorage, status →
   ISSUED, LibanPost log appears in console, citizen notified
6. Dev Panel: set to DELIVERED
7. Citizen dashboard: application shows DELIVERED
8. Status timeline: all 7 stages render correctly

**Renewal — Expiry Banner to Delivered:**
1. Log in as Sara Mansour (has seeded near-expiry passports)
2. Confirm expiry banners appear with correct severity tiers
3. Click "Renew Now" on warning-tier banner → checklist →
   application form opens at Step 2 with RENEWAL pre-selected
4. Submit renewal, complete payment
5. Confirm expiry banner for that passport disappears
   (renewingPassportId is set, renewal is active and paid)
6. Dev Panel: VERIFIED → MUKHTAR_SIGNED → PROCESSED → Officer flow
7. Officer issues passport with new booklet number →
   old passport record status → CANCELLED
8. Dev Panel: DELIVERED
9. Citizen dashboard: new passport record now drives expiry
   (far future date — no banner for this passport)
10. Old passport: status CANCELLED — no banner

**Cross-Check Session 10 Receipt Feature:**
11. Confirm receipt download still works after PassportApplication
    interface change (renewingPassportId field addition should not
    break existing receipt generation)

**Dev Panel:**
12. Set any application to ISSUED via Dev Panel — confirm booklet
    number prompt appears, passport record is created
13. Set to DELIVERED after ISSUED — confirm no duplicate passport
    record created

Report any failure with step, expected, actual, suspected file.

## What NOT to Build
- No real LibanPost integration (FR-31–FR-33 remain deferred)
- No real booklet number validation against an external registry
- No biometric data on the passport record (out of scope for v1)
- No multi-passport UI for citizens with more than one active
  passport (v1 simplification — flag with comment)
- No backend integration