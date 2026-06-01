/**
 * RemindIQ 3N.11 Reminder Store
 *
 * Purpose:
 * Prevent alarms from firing from transient drafts.
 *
 * Rule:
 * A reminder must be persisted before any alarm/notification is scheduled.
 */

export type ReminderStatus3N11 =
  | "confirmed"
  | "scheduled"
  | "ringing"
  | "snoozed"
  | "dismissed"
  | "notified"
  | "missed";

export type Reminder3N11 = {
  id: string;
  title: string;
  rawText?: string;
  dateText?: string;
  datePhrase?: string;
  timeText: string;
  dueAt: string;
  status: ReminderStatus3N11;
  category?: string;
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string | null;
  dismissedAt?: string | null;
  snoozedUntil?: string | null;
  approximateTime?: boolean;
  eventAt?: string | null;
  sourceDraftId?: string | null;
  repeatRule?: unknown | null;
  isAlarm?: boolean;
};

const REMINDIQ_REMINDERS_KEY = "remindiq.reminders.v3N11";

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function uuid3N11(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTitle(title: string): string {
  return String(title ?? "").replace(/\s+/g, " ").trim();
}

export function listReminders3N11(): Reminder3N11[] {
  const reminders = safeJsonParse<Reminder3N11[]>(
    localStorage.getItem(REMINDIQ_REMINDERS_KEY),
    []
  );

  return reminders.sort((a, b) => {
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export function getReminder3N11(id: string): Reminder3N11 | null {
  return listReminders3N11().find((item) => item.id === id) ?? null;
}

export function saveReminder3N11(input: Partial<Reminder3N11> & {
  title: string;
  dueAt: string;
  timeText: string;
}): Reminder3N11 {
  const title = normalizeTitle(input.title);

  if (!title) {
    throw new Error("Cannot save reminder without title.");
  }

  const dueAtMs = new Date(input.dueAt).getTime();
  if (!Number.isFinite(dueAtMs)) {
    throw new Error("Cannot save reminder without valid dueAt.");
  }

  const now = new Date().toISOString();
  const reminder: Reminder3N11 = {
    id: input.id || uuid3N11(),
    title,
    rawText: input.rawText || title,
    dateText: input.dateText || "Today",
    datePhrase: input.datePhrase || "today",
    timeText: input.timeText,
    dueAt: input.dueAt,
    status: input.status || "confirmed",
    category: input.category || "General",
    createdAt: input.createdAt || now,
    updatedAt: now,
    notifiedAt: input.notifiedAt ?? null,
    dismissedAt: input.dismissedAt ?? null,
    snoozedUntil: input.snoozedUntil ?? null,
    approximateTime: Boolean(input.approximateTime),
    eventAt: input.eventAt ?? null,
    sourceDraftId: input.sourceDraftId ?? null,
    repeatRule: input.repeatRule ?? null,
    isAlarm: Boolean(input.isAlarm),
  };

  const existing = listReminders3N11();
  const withoutCurrent = existing.filter((item) => item.id !== reminder.id);
  const next = [...withoutCurrent, reminder];

  localStorage.setItem(REMINDIQ_REMINDERS_KEY, JSON.stringify(next));

  const saved = getReminder3N11(reminder.id);
  if (!saved) {
    throw new Error("Reminder save verification failed.");
  }

  return saved;
}

export function updateReminder3N11(id: string, patch: Partial<Reminder3N11>): Reminder3N11 {
  const reminders = listReminders3N11();
  const current = reminders.find((item) => item.id === id);

  if (!current) {
    throw new Error(`Reminder not found: ${id}`);
  }

  const updated: Reminder3N11 = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(
    REMINDIQ_REMINDERS_KEY,
    JSON.stringify(reminders.map((item) => item.id === id ? updated : item))
  );

  return updated;
}

export function markReminderRinging3N11(id: string): Reminder3N11 {
  return updateReminder3N11(id, { status: "ringing" });
}

export function dismissReminder3N11(id: string): Reminder3N11 {
  return updateReminder3N11(id, {
    status: "dismissed",
    dismissedAt: new Date().toISOString(),
    notifiedAt: new Date().toISOString(),
  });
}

export function snoozeReminder3N11(id: string, minutes = 5): Reminder3N11 {
  const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString();

  return updateReminder3N11(id, {
    status: "snoozed",
    dueAt: snoozedUntil,
    snoozedUntil,
    notifiedAt: null,
    dismissedAt: null,
  });
}

export function getUpcomingReminders3N11(now = new Date()): Reminder3N11[] {
  const nowMs = now.getTime();
  return listReminders3N11().filter((item) => {
    const dueMs = new Date(item.dueAt).getTime();
    return dueMs > nowMs && !item.notifiedAt && !["dismissed", "notified"].includes(item.status);
  });
}

export function getRemindedReminders3N11(now = new Date()): Reminder3N11[] {
  const nowMs = now.getTime();
  return listReminders3N11().filter((item) => {
    const dueMs = new Date(item.dueAt).getTime();
    return Boolean(item.notifiedAt) || item.status === "dismissed" || item.status === "notified";
  });
}

export function getDueReminders3N11(now = new Date()): Reminder3N11[] {
  const nowMs = now.getTime();
  return listReminders3N11().filter((item) => {
    const dueMs = new Date(item.dueAt).getTime();
    return dueMs <= nowMs && !item.notifiedAt && !["dismissed", "notified"].includes(item.status);
  });
}
