Build a Notification Center UI for the NPIS citizen portal.

Context: `notificationService.ts` already stores notifications in localStorage under `notifications_<userId>`. Each notification has fields: `id`, `userId`, `type`, `title`, `message`, `read` (boolean), `createdAt`, `applicationId` (optional).

Tasks:
1. Add a bell icon button to the CitizenDashboard header (top-right area). Show a red badge with the count of unread notifications.
2. Clicking the bell opens a dropdown panel (not a new page) listing all notifications for the current user, sorted newest first.
3. Each notification item shows: title, message, relative time (e.g. "2 hours ago"), and a visual distinction between read (muted) and unread (bold/highlighted).
4. Clicking a notification marks it as read (calls a `markAsRead(notificationId)` function in notificationService) and if it has an `applicationId`, navigates to `/application/status/:applicationId`.
5. Add a "Mark all as read" button at the top of the dropdown.
6. Add `markAsRead`, `markAllAsRead`, and `getUnreadCount` functions to `notificationService.ts` if they don't already exist.
7. The dropdown closes when clicking outside it.

Style: Match the existing Tailwind CSS design of the dashboard. No new libraries.