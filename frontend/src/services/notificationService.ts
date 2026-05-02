// Handles FR-23 (resubmission notifications), FR-32 (delivery notifications)

export interface Notification {
  notificationId: string;
  userId: string;
  type: "RESUBMISSION_REQUIRED" | "STATUS_UPDATE" | "DELIVERY";
  title?: string;
  message: string;
  applicationId?: string;
  read: boolean;
  createdAt: string;
}

const notificationsKey = (userId: string) => `notifications_${userId}`;

export const notificationService = {
  // TODO: GET /api/notifications
  getNotifications: (userId: string): Notification[] => {
    const stored = localStorage.getItem(notificationsKey(userId));
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  // TODO: PUT /api/notifications/:id/read
  markAsRead: (userId: string, notificationId: string): void => {
    const notifications = notificationService.getNotifications(userId);
    const idx = notifications.findIndex(
      (n) => n.notificationId === notificationId,
    );
    if (idx >= 0) {
      notifications[idx].read = true;
      localStorage.setItem(
        notificationsKey(userId),
        JSON.stringify(notifications),
      );
    }
  },

  // TODO: PUT /api/notifications/read-all
  markAllAsRead: (userId: string): void => {
    const notifications = notificationService.getNotifications(userId);
    const updated = notifications.map((n) => ({ ...n, read: true }));
    localStorage.setItem(notificationsKey(userId), JSON.stringify(updated));
  },

  // Called internally when application status changes (FR-23, FR-32)
  addNotification: (
    userId: string,
    notification: Omit<Notification, "notificationId" | "createdAt" | "read">,
  ): void => {
    const notifications = notificationService.getNotifications(userId);
    const newNotification: Notification = {
      ...notification,
      notificationId: "notif_" + Date.now(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.push(newNotification);
    localStorage.setItem(
      notificationsKey(userId),
      JSON.stringify(notifications),
    );
  },

  getUnreadCount: (userId: string): number => {
    return notificationService.getNotifications(userId).filter((n) => !n.read)
      .length;
  },
};
