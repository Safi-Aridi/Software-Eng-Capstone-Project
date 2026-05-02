Add a pre-application checklist interstitial screen to the NPIS passport application flow.

Context: The application form starts at `/application/new` with `NewPassportApplicationPage.tsx`. Citizens currently jump straight into the multi-step form.

Tasks:
1. Create a new page `src/pages/PreApplicationChecklistPage.tsx` at route `/application/checklist`.
2. The page shows two tabs or toggle sections: "New Passport" and "Passport Renewal".
3. For each type, display a checklist of required documents with acceptance criteria:

   New Passport:
   - Lebanese National ID Card OR Civil Registry Extract (issued < 3 months ago, QR code scannable)
   - Passport Photo (3.5 x 4.5 cm, white background, clear facial visibility)
   - Device with front-facing camera (for biometric capture)

   Passport Renewal:
   - Lebanese National ID Card OR Civil Registry Extract (issued < 3 months ago)
   - Passport Photo (3.5 x 4.5 cm, white background, clear facial visibility)
   - Old Passport (legible MRZ, not reported lost/stolen)

4. Each checklist item has a checkbox the user can tick. The "I'm Ready — Start Application" button is disabled until all items are checked.
5. On clicking "I'm Ready", navigate to `/application/new`.
6. Update `CitizenDashboard.tsx`: the "Apply for Passport" button should now navigate to `/application/checklist` instead of `/application/new`.
7. Add route `/application/checklist` to `App.tsx` (protected, citizen only).

Style: Match existing Tailwind CSS dashboard design. Make it feel informative and reassuring, not bureaucratic.