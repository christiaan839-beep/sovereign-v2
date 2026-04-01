/**
 * SOVEREIGN MATRIX -- Client-side Notification System
 *
 * localStorage-based notification store for MVP.
 * Supports workflow_complete, usage_warning, agent_error, system_update types.
 */

export type NotificationType =
  | "workflow_complete"
  | "usage_warning"
  | "agent_error"
  | "system_update";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  href?: string;
}

const STORAGE_KEY = "sovereign_notifications";
const MAX_NOTIFICATIONS = 100;

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readStore(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Notification[];
  } catch {
    return [];
  }
}

function writeStore(notifications: Notification[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep only the most recent notifications
    const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function getNotifications(): Notification[] {
  return readStore();
}

export function addNotification(
  n: Omit<Notification, "id" | "timestamp" | "read">
): Notification {
  const notification: Notification = {
    ...n,
    id: generateId(),
    timestamp: new Date().toISOString(),
    read: false,
  };
  const existing = readStore();
  writeStore([notification, ...existing]);
  // Dispatch custom event so other components can react
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sovereign:notification", { detail: notification }));
  }
  return notification;
}

export function markAsRead(id: string): void {
  const notifications = readStore();
  const idx = notifications.findIndex((n) => n.id === id);
  if (idx !== -1) {
    notifications[idx].read = true;
    writeStore(notifications);
  }
}

export function markAllRead(): void {
  const notifications = readStore();
  for (const n of notifications) {
    n.read = true;
  }
  writeStore(notifications);
}

export function getUnreadCount(): number {
  return readStore().filter((n) => !n.read).length;
}

export function clearNotifications(): void {
  writeStore([]);
}

export function removeNotification(id: string): void {
  const notifications = readStore().filter((n) => n.id !== id);
  writeStore(notifications);
}
