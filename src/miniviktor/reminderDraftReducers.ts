export type ReminderAlert = {
  id: string;
  dateISO?: string | null;
  dateLabel?: string;
  datePhrase?: string;
  timeText?: string;
  dueAt?: string | null;
  approximate?: boolean;
};

export type RepeatRule = {
  kind?: "daily" | "weekly" | "hourly" | "custom";
  intervalMinutes?: number;
  label?: string;
  timeText?: string;
  endDateISO?: string | null;
  endDatePhrase?: string;
} | null;

export type ReminderDraft = {
  id: string;
  task: string;
  rawText?: string;
  eventDateISO?: string | null;
  eventDatePhrase?: string;
  eventTimeText?: string;
  eventAt?: string | null;
  alerts: ReminderAlert[];
  category?: string;
  pendingAmbiguousTime?: string | null;
  pendingInferenceConfirmation?: string | null;
  lastQuestion?: string | null;
  repeatRule?: RepeatRule;
  isAlarm?: boolean;
  pendingRepeatQuestion?: string | null;
  editMode?: boolean;
};

type ChangeType = "rename" | "time" | "date" | "repeat" | "save";

export function applyRename(draft: ReminderDraft, title: string): ReminderDraft {
  const cleanedTitle = cleanTitle(title);
  return { ...draft, task: cleanedTitle || draft.task, rawText: appendRaw(draft.rawText, `name ${cleanedTitle}`), editMode: true, lastQuestion: "confirm" };
}

export function applyTimeChange(draft: ReminderDraft, timePhrase: string, now: Date): ReminderDraft {
  const parsed = parseTimePhrase(timePhrase, now);
  const updatedAlert: ReminderAlert = { ...(draft.alerts?.[0] || { id: cryptoSafeId() }), timeText: parsed.timeText, dueAt: parsed.dueAt, approximate: false };
  return {
    ...draft,
    task: draft.task,
    eventTimeText: parsed.eventTimeText,
    eventAt: parsed.eventAt || draft.eventAt,
    alerts: [updatedAlert, ...(draft.alerts || []).slice(1)],
    rawText: appendRaw(draft.rawText, timePhrase),
    editMode: true,
    lastQuestion: "confirm",
    pendingAmbiguousTime: null,
    pendingInferenceConfirmation: null,
  };
}

export function applyDateChange(draft: ReminderDraft, datePhrase: string, now: Date): ReminderDraft {
  const dateISO = resolveDateISO(datePhrase, now);
  const normalizedPhrase = datePhrase.toLowerCase().trim();
  return {
    ...draft,
    eventDateISO: dateISO,
    eventDatePhrase: normalizedPhrase,
    alerts: (draft.alerts || []).map((alert) => ({ ...alert, dateISO, datePhrase: normalizedPhrase, dateLabel: titleCase(normalizedPhrase) })),
    rawText: appendRaw(draft.rawText, datePhrase),
    editMode: true,
    lastQuestion: "confirm",
  };
}

export function applyRepeatChange(draft: ReminderDraft, repeatPhrase: string): ReminderDraft {
  const normalized = repeatPhrase.toLowerCase();
  let repeatRule: RepeatRule = draft.repeatRule || { kind: "custom", intervalMinutes: undefined };
  if (/every\s+1\s+hour|after\s+1\s+hour|hourly/.test(normalized)) repeatRule = { ...repeatRule, kind: "hourly", intervalMinutes: 60, label: /today only/.test(normalized) ? "Repeats every 1 hour · today only" : "Repeats every 1 hour" };
  else if (/daily/.test(normalized)) repeatRule = { ...repeatRule, kind: "daily", intervalMinutes: 1440, label: "Repeats daily" };
  else if (/weekly/.test(normalized)) repeatRule = { ...repeatRule, kind: "weekly", intervalMinutes: 10080, label: "Repeats weekly" };
  if (/today only/.test(normalized)) repeatRule = { ...repeatRule, endDatePhrase: "today", label: repeatRule?.label?.includes("today only") ? repeatRule.label : `${repeatRule?.label || "Repeats"} · today only` };
  return { ...draft, repeatRule, rawText: appendRaw(draft.rawText, repeatPhrase), editMode: true, lastQuestion: "confirm", pendingRepeatQuestion: null };
}

export function cancelDraft(_draft: ReminderDraft): null { return null; }

export function formatDraftConfirmation(draft: ReminderDraft, changeType: ChangeType): string {
  const title = draft.task || "this reminder";
  const time = draft.eventTimeText || draft.alerts?.[0]?.timeText || "the selected time";
  const date = draft.eventDatePhrase || draft.alerts?.[0]?.datePhrase || "today";
  const repeat = draft.repeatRule?.label ? ` ${draft.repeatRule.label}.` : "";
  const prefix = changeType === "rename" ? "Updated name" : changeType === "time" ? "Updated time" : changeType === "date" ? "Updated date" : changeType === "repeat" ? "Updated repeat" : "Ready";
  return `${prefix} — ${title} is ${date} at ${time}.${repeat} Should I save this reminder, adjust it, or drop it?`;
}

function parseTimePhrase(timePhrase: string, now: Date): { timeText: string; eventTimeText: string; dueAt: string; eventAt: string } {
  const cleaned = timePhrase.toLowerCase().replace(/\./g, "").trim();
  if (/minute from now|minutes from now|now/.test(cleaned)) {
    const amountMatch = cleaned.match(/(\d+)\s+minutes?/);
    const amount = amountMatch ? Number(amountMatch[1]) : 1;
    const due = new Date(now.getTime() + amount * 60000);
    return { timeText: formatTime(due), eventTimeText: `${amount} minute${amount === 1 ? "" : "s"} from now`, dueAt: due.toISOString(), eventAt: due.toISOString() };
  }
  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return { timeText: timePhrase, eventTimeText: timePhrase, dueAt: now.toISOString(), eventAt: now.toISOString() };
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const ampm = match[3];
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  const due = new Date(now);
  due.setHours(hour, minute, 0, 0);
  const timeText = formatTime(due);
  return { timeText, eventTimeText: timeText, dueAt: due.toISOString(), eventAt: due.toISOString() };
}

function resolveDateISO(datePhrase: string, now: Date): string {
  const cleaned = datePhrase.toLowerCase().trim();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (cleaned === "tomorrow") d.setDate(d.getDate() + 1);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const target = cleaned.replace(/^next\s+/, "");
  const targetIndex = days.indexOf(target);
  if (targetIndex >= 0) {
    const current = d.getDay();
    let add = (targetIndex - current + 7) % 7;
    if (add === 0 || cleaned.startsWith("next ")) add += 7;
    d.setDate(d.getDate() + add);
  }
  return d.toISOString();
}

function cleanTitle(value: string): string { return value.replace(/^name\s+(the\s+)?(alarm|reminder)?\s*(as)?\s*/i, "").replace(/^rename\s+(it\s+)?(to)?\s*/i, "").replace(/^call\s+(it\s+)?/i, "").trim().replace(/\s+/g, " "); }
function appendRaw(existing: string | undefined, addition: string): string { const cleanAddition = addition.trim(); if (!existing) return cleanAddition; if (!cleanAddition) return existing; return `${existing} | ${cleanAddition}`; }
function titleCase(value: string): string { return value.replace(/\b\w/g, (char) => char.toUpperCase()); }
function formatTime(date: Date): string { return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase(); }
function cryptoSafeId(): string { try { if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID(); } catch {} return `id-${Math.random().toString(36).slice(2)}`; }
