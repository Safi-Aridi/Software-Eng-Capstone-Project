Add an explicit fee acknowledgment checkbox to Step 6 (Review & Submit) of the passport application form.

Context: `NewPassportApplicationPage.tsx` Step 6 already shows the fee amount. The citizen currently submits without explicitly confirming.

Tasks:
1. In Step 6 of `NewPassportApplicationPage.tsx`, add a checkbox directly above the "Submit Application" button with label:
   "I acknowledge that I am required to pay [fee amount in LBP] to complete this application. I understand that failure to complete payment within 15 minutes will result in the application being cancelled."
2. The "Submit Application" button is disabled until this checkbox is checked.
3. The checkbox state resets if the user navigates back to a previous step.

This is a small but required change per FR-09 and UX requirements.