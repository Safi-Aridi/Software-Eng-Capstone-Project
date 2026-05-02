Improve the DocumentResubmissionPage to show per-document rejection reasons and acceptance criteria.

Context: `DocumentResubmissionPage.tsx` currently shows upload fields but no guidance. The application object in localStorage has a `resubmissionReasons` field (add it if missing) that can contain an object like:
`{ identityDocument: "Photo on ID does not match passport photo", passportPhoto: "Background is not pure white" }`

Tasks:
1. Update the `PassportApplication` interface in `applicationService.ts` to include:
   `resubmissionReasons?: { identityDocument?: string; passportPhoto?: string; oldPassport?: string }`

2. In `DocumentResubmissionPage.tsx`:
   - Show a red alert banner at the top: "Your documents require corrections. Please review the issues below and resubmit."
   - For each document field (Identity Document, Passport Photo, Old Passport if renewal), if a rejection reason exists for that field, show it as a red inline error beneath the field label.
   - Below each rejection reason, show the acceptance criteria for that document type (same criteria as the pre-application checklist).
   - If no rejection reason exists for a field, show it normally with a green "✓ Previously accepted" indicator so the citizen knows not to re-upload it (but still allow re-upload).

3. In `DevStatusPanel.tsx` (dev tool), when setting status to `RESUBMISSION_REQUIRED`, also seed mock `resubmissionReasons` onto the application: `{ identityDocument: "Photo on ID does not match passport photo" }`.

Style: Match existing Tailwind CSS design. Use red for errors, green for accepted, amber for warnings.