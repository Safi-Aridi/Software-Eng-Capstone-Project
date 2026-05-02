Create a Citizen Profile page for the NPIS portal.

Tasks:
1. Create `src/pages/CitizenProfilePage.tsx` at route `/citizen/profile`.
2. The page displays two sections:

   Identity Information (read-only — sourced from `identity_data_<userId>` in localStorage):
   - Full Name
   - National Registry Number
   - Date of Birth

   Contact Information (editable):
   - Email address
   - Mobile number
   Each field has an "Edit" button that toggles it into an input field with Save/Cancel.
   On Save, update the user record in `npis_users` localStorage array.
   Show a green "Saved successfully" toast on save.

3. Add a "Profile" link or icon button to the CitizenDashboard header (next to the logout button).
4. Add route `/citizen/profile` to `App.tsx` (protected, citizen only).
5. Wrap the page in `CitizenLayout` so the AI assistant widget appears.

Style: Match existing Tailwind CSS dashboard design. Clean card layout.