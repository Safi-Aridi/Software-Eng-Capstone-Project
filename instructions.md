# Phase 10 — Bug Fixes: Expiry Renewal Flow & Payment Receipt Timing

## Context
Read `ProjectSummary.md` for full context. Two UX issues were found after 
reviewing the Phase 10 plan. Fix these before or alongside building the 
Phase 10 features.

---

## Fix 1 — Expiry Banner "Renew Now" Must Pre-Select Renewal

### Problem
The "Renew Now" button on the expiry reminder banner routes to
`/application/checklist` which leads to the full application form
starting at Step 1 (type selection). The citizen has to manually
pick "Passport Renewal" — this is redundant and breaks the flow.

### Fix

**`PreApplicationChecklistPage.tsx`**
- Read `?type=RENEWAL` query param if present
- Pass it forward to `/application/new?type=RENEWAL` on the
  "Start Application" button
- If `?type=RENEWAL` is present, update the checklist copy to show
  renewal-specific document requirements (old passport scan required)
  instead of the generic new-passport list. The checklist items should
  reflect: identity document, passport photo, AND old passport scan.

**`NewPassportApplicationPage.tsx`**
- On mount, read `?type` query param from the URL
- If `?type=RENEWAL`, set `applicationType` to `'RENEWAL'` in state
  and set `currentStep` to 2 (skip Step 1 type selection entirely)
- If `?type=NEW`, same logic pre-selecting NEW
- If no param, behavior is unchanged (Step 1 shown, citizen chooses)
- The skipped Step 1 should not be reachable via the Back button when
  type was pre-selected from the URL (Back from Step 2 should go to
  the checklist or the dashboard, not Step 1)

**Expiry banner in `CitizenDashboard.tsx`**
- Update "Renew Now" button href from `/application/checklist`
  to `/application/checklist?type=RENEWAL&fromExpiry=<applicationId>`

**`fromExpiry` param (optional, non-breaking)**
- If present, `NewPassportApplicationPage` can store it on the
  application record as a reference (or ignore it). Not required
  for the fix but include it for traceability.

---

## Fix 2 — Payment Receipt Timing

### Problem
After successful payment, the citizen is auto-redirected to the
dashboard after 3 seconds. There is not enough time to download
the receipt. The receipt button should not be a now-or-never moment.

### Fix — Three-Part Solution

**Part A — Pause countdown on receipt download (`PaymentPage.tsx`)**
- The auto-redirect countdown pauses immediately when the citizen
  clicks "Download Receipt"
- After the download triggers (i.e., after `receiptService
  .generateReceipt()` resolves), show a manual "Continue to Dashboard"
  button instead of resuming the countdown
- This way: users who don't touch the receipt are auto-redirected
  in 5 seconds (increase from 3 to 5 to give more reading time);
  users who download get full control of when they leave

**Part B — Extend countdown from 3 to 5 seconds (`PaymentPage.tsx`)**
- Change the auto-redirect timer from 3 seconds to 5 seconds
- Update the countdown display text accordingly
- This gives enough time to read the success message and notice
  the receipt button even without clicking it

**Part C — Permanent receipt button on dashboard 
  (`CitizenDashboard.tsx`)**
- For any application card where `paymentStatus === 'Paid'`, render
  a "Download Receipt" action alongside "Track Application"
- This makes the receipt available at any time, not just at the
  payment moment — so the countdown pressure is fully removed
- Style as a secondary/text button to keep "Track Application"
  as the primary card action

### Updated PaymentPage Success State Layout
After the fix, the success state should render in this order:
1. Green checkmark + "Payment Successful" heading
2. Application summary (tracking number, fee, payment reference)
3. "Download Receipt" button (secondary) — clicking pauses countdown
4. Countdown text: "Redirecting to dashboard in X seconds..." 
   OR "Download complete. Continue when ready." after download
5. Manual "Go to Dashboard" button (always visible, doesn't wait
   for countdown — lets impatient users skip immediately)

---

## Constraints
- Do not change any other part of the payment flow (FR-28, FR-29,
  FR-30 simulation logic stays identical)
- Do not change the application form step content — only the
  entry step and Back button behavior change
- Do not add new routes
- Match existing button styles, countdown display, and toast patterns
- All service calls remain async and await-ed

## Smoke Test

**Fix 1:**
1. Log in as citizen with a near-expiry delivered passport
2. Click "Renew Now" on the expiry banner
3. Confirm the checklist page shows renewal-specific document list
4. Click "Start Application"
5. Confirm the form opens at Step 2 (Passport Details) with
   RENEWAL pre-selected — Step 1 is never shown
6. Click Back from Step 2 — confirm it goes to checklist or
   dashboard, not Step 1
7. Navigate to `/application/new` directly (no param) — confirm
   Step 1 still shows normally

**Fix 2:**
1. Submit an application and complete payment successfully
2. On the success screen, confirm countdown reads 5 seconds
3. Click "Download Receipt" — confirm countdown pauses,
   PDF downloads, "Continue when ready" message appears
4. Click "Go to Dashboard" manually — confirm redirect
5. On the dashboard, find the paid application card —
   confirm "Download Receipt" button is present
6. Click it — confirm PDF downloads correctly
7. Repeat payment flow but do NOT click receipt — confirm
   auto-redirect fires after 5 seconds as normal

Report any failure with step, expected behavior, actual behavior,
and suspected file.