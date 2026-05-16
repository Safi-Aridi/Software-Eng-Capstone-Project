import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  notificationService,
  type Notification,
} from "../services/notificationService";

const TYPE_TITLES: Record<Notification["type"], string> = {
  RESUBMISSION_REQUIRED: "Resubmission Required",
  STATUS_UPDATE: "Status Update",
  DELIVERY: "Delivery Update",
};

const formatRelativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

type NotificationCenterProps = {
  userId: string;
  variant?: "default" | "light";
};

const NotificationCenter = ({ userId, variant = "default" }: NotificationCenterProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const refresh = () => {
    setNotifications(notificationService.getNotifications(userId));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const sorted = [...notifications].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const unreadCount = sorted.filter((n) => !n.read).length;

  const handleToggle = () => {
    if (!open) refresh();
    setOpen((v) => !v);
  };

  const handleClickNotification = (n: Notification) => {
    if (!n.read) {
      notificationService.markAsRead(userId, n.notificationId);
      refresh();
    }
    setOpen(false);
    if (n.applicationId) {
      navigate(`/application/status/${n.applicationId}`);
    }
  };

  const handleMarkAll = () => {
    notificationService.markAllAsRead(userId);
    refresh();
  };

  const triggerButtonClass =
    variant === "light"
      ? "relative p-2 rounded-full text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
      : "relative p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        className={triggerButtonClass}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold text-white bg-red-600 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <button
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications yet.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {sorted.map((n) => {
                  const title = n.title || TYPE_TITLES[n.type];
                  return (
                    <li key={n.notificationId}>
                      <button
                        onClick={() => handleClickNotification(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                          n.read ? "bg-white" : "bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && (
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm ${
                                n.read
                                  ? "text-gray-600 font-normal"
                                  : "text-gray-900 font-semibold"
                              }`}
                            >
                              {title}
                            </p>
                            <p
                              className={`text-sm mt-0.5 ${
                                n.read ? "text-gray-500" : "text-gray-700"
                              }`}
                            >
                              {n.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatRelativeTime(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
