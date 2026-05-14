// Handles FR-23 (resubmission notifications), FR-32 (delivery notifications)
//
// The notification UI calls these methods synchronously (no `await`). When
// wired to the real backend we therefore use a localStorage-backed cache:
// reads return cached data immediately and kick off a background fetch that
// refreshes the cache, so the next render picks up server-side updates.

import { apiClient } from "./apiClient";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_NOTIFICATIONS === "true";

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

interface ApiNotification {
  notification_id: string;
  user_id: string;
  application_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

const mapApiNotification = (n: ApiNotification): Notification => ({
  notificationId: n.notification_id,
  userId: n.user_id,
  // Backend has no type/title columns yet — derive a generic STATUS_UPDATE.
  type: "STATUS_UPDATE",
  message: n.message,
  applicationId: n.application_id ?? undefined,
  read: n.is_read,
  createdAt: n.created_at,
});

const readCache = (userId: string): Notification[] => {
  const stored = localStorage.getItem(notificationsKey(userId));
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const writeCache = (userId: string, notifications: Notification[]): void => {
  localStorage.setItem(notificationsKey(userId), JSON.stringify(notifications));
};

// Fire-and-forget background refresh of the cache from the real API.
const refreshFromApi = (userId: string): void => {
  if (USE_MOCK || !userId) return;
  void apiClient
    .get<ApiNotification[]>(
      `/notifications?userId=${encodeURIComponent(userId)}`,
    )
    .then((rows) => writeCache(userId, rows.map(mapApiNotification)))
    .catch(() => {
      // Network blip — keep stale cache; next call will retry.
    });
};

export const notificationService = {
  getNotifications: (userId: string): Notification[] => {
    if (!USE_MOCK) {
      refreshFromApi(userId);
    }
    return readCache(userId);
  },

  markAsRead: (userId: string, notificationId: string): void => {
    const notifications = readCache(userId);
    const idx = notifications.findIndex(
      (n) => n.notificationId === notificationId,
    );
    if (idx >= 0) {
      notifications[idx].read = true;
      writeCache(userId, notifications);
    }
    if (!USE_MOCK) {
      void apiClient
        .patch(`/notifications/${notificationId}/read`, {})
        .catch(() => {
          // ignore — cache already updated; retry on next render
        });
    }
  },

  markAllAsRead: (userId: string): void => {
    const notifications = readCache(userId);
    writeCache(
      userId,
      notifications.map((n) => ({ ...n, read: true })),
    );
    if (!USE_MOCK) {
      void apiClient
        .patch(`/notifications/read-all`, { userId })
        .catch(() => {
          // ignore — see above
        });
    }
  },

  // Server-side creation handles real-mode notifications. In mock mode this
  // is still the path used by mukhtarService/officerService to seed local
  // notifications.
  create: (
    userId: string,
    notification: Omit<Notification, "notificationId" | "createdAt" | "read">,
  ): void => {
    if (!USE_MOCK) {
      // Server emits notifications on every status transition.
      return;
    }
    const notifications = readCache(userId);
    const newNotification: Notification = {
      ...notification,
      notificationId:
        "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.push(newNotification);
    writeCache(userId, notifications);
  },

  // Backward-compat alias — prefer create() for new code
  addNotification: (
    userId: string,
    notification: Omit<Notification, "notificationId" | "createdAt" | "read">,
  ): void => {
    notificationService.create(userId, notification);
  },

  getUnreadCount: (userId: string): number => {
    if (!USE_MOCK) refreshFromApi(userId);
    return readCache(userId).filter((n) => !n.read).length;
  },
};
