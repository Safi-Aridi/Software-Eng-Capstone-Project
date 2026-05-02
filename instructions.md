Fix the lock functionality and implement the account lockout countdown screen for the NPIS citizen login.

Context: `authService.ts` must lock the account after 3 consecutive failed login attempts and stores lock state in localStorage. FR-05.1 requires a 15-minute auto-unlock.

Tasks:
1. Fix the lock functionality in `authService.ts` to properly track failed login attempts and lock the account after 3 failed attempts.
2. In `CitizenLoginPage.tsx`, after a failed login that triggers a lock, replace the login form with a "Your account is locked" panel showing:
   - A lock icon
   - Message: "Too many failed attempts. Your account has been locked."
   - A live countdown timer: "Try again in MM:SS" that counts down from 15:00
   - When the timer reaches 0:00, the panel automatically switches back to the login form and the lock is cleared in localStorage.
3. If the user refreshes the page while locked, calculate the remaining lock time from the stored `lockedAt` timestamp and show the correct remaining time.
4. Add `lockAccount(userId)`, `isAccountLocked(userId)`, and `getRemainingLockTime(userId)` to `authService.ts`. Lock duration = 15 minutes. Store `lockedAt` timestamp in localStorage.
5. On login attempt: check `isAccountLocked` first — if locked, show the countdown panel immediately without processing credentials.

Style: Match existing Tailwind CSS design of CitizenLoginPage.