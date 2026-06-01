/*
 RemindIQ Sprint 3M.3 Hotfix
 Purpose:
 1) Prevent MiniViktor from assuming repeat interval from "starting in X minutes".
 2) Treat "today only" / "only today" as repeat end-scope, not repeat kind.
 3) Recognise common voice-misrecognition variants: "everyone", "every one", "receive everyone", "receives every one" as "every 1 hour" ONLY when the phrase is clearly part of a repeating alarm/reminder.
 4) Provide safe cancel/scrap synonyms for draft clear.

 Drop-in use:
 - Import this file from your MiniViktor parser/orchestrator.
 - Run resolveSprint3M3RepeatClarification(input, activeDraft, now) BEFORE the generic reminder parser.
 - If returned.handled === true, use returned.draft + returned.message + returned.readyToConfirm.
*/

export type Sprint3M3RepeatKind = "hourly" | "daily" | "weekly" | "interval";

export interface Sprint3M3Alert {
  id?: string;
  dateISO?: string;
  dateLabel?: string;
  datePhrase?: string;
  timeText: string;
  dueAt: string;
  approximate?: boolean;
}

export interface Sprint3M3RepeatRule {
  kind: Sprint3M3RepeatKind;
  intervalMinutes?: number;
  label: string;
  timeText?: string;
  endDateISO?: string;
  endDatePhrase?: string;
}

export interface Sprint3M3Draft {
  id?: string;
  task?: string;
  rawText?: string;
  eventDateISO?: string;
  eventDatePhrase?: string;
  eventTimeText?: string;
  eventAt?: string | null;
  alerts?: Sprint3M3Alert[];
  category?: string;
  pendingAmbiguousTime?: unknown;
  pendingInferenceConfirmation?: unknown;
  lastQuestion?: string | null;
  repeatRule?: Sprint3M3RepeatRule | null;
  isAlarm?: boolean;
  pendingRepeatQuestion?: string | null;
}

export interface Sprint3M3Resolution {
  handled: boolean;
  draft: Sprint3M3Draft | null;
  message: string;
  readyToConfirm: boolean;
  clearDraft?: boolean;
}

const CANCEL_DRAFT_PATTERNS = [
  /\b(scrap that|scrap it)\b/i,
  /\b(drop that|drop it|drop this)\b/i,
  /\b(cancel that|cancel it|cancel this|cancel current|cancel reminder|cancel alarm)\b/i,
  /\b(ignore that|ignore it|ignore this|ignore previous|ignore the previous one)\b/i,
  /\b(delete that|delete it|delete this)\b/i,
  /\b(discard that|discard it|discard this)\b/i,
  /\b(abandon that|abandon it|abandon this)\b/i,
  /\b(start over|restart|reset|clear draft|clear this)\b/i,
  /\b(never mind|nevermind|leave it|forget it|forget that)\b/i,
];

export function isSprint3M3CancelDraftText(text: string): boolean {
  const clean = normalizeSprint3M3Text(text);
  return CANCEL_DRAFT_PATTERNS.some((pattern) => pattern.test(clean));
}

export function normalizeSprint3M3Text(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\bp\.\s*m\.?\b/g, "pm")
    .replace(/\ba\.\s*m\.?\b/g, "am")
    .replace(/\btmrw\b|\btmr\b|\btomorro\b|\btommorow\b|\btomrro\b|\btmoro\b/g, "tomorrow")
    .replace(/\btdy\b|\btodday\b/g, "today")
    .replace(/\bevery one\b/g, "everyone")
    .replace(/\beveryone\b/g, "every 1 hour")
    .replace(/\breceives? every 1 hour\b/g, "repeats every 1 hour")
    .replace(/\breceive every 1 hour\b/g, "repeat every 1 hour")
    .replace(/\brepeats? after every 1 hour\b/g, "repeats every 1 hour")
    .replace(/\brepeats? after 1 hour\b/g, "repeats every 1 hour")
    .replace(/\brepetition should be after 1 hour\b/g, "repeats every 1 hour")
    .replace(/\brepeaters today only\b/g, "today only")
    .replace(/\s+/g, " ")
    .trim();
}

function isRepeatIntent(text: string): boolean {
  return /\b(repeat|repeating|repetitive|repetition|repeats|every)\b/i.test(text);
}

function isAlarmIntent(text: string): boolean {
  return /\b(alarm|wake me|ring)\b/i.test(text);
}

function hasTodayOnly(text: string): boolean {
  return /\b(today only|only today|for today only)\b/i.test(text);
}

function hasRepeatInterval(text: string): boolean {
  return /\b(every|repeats? every|repeat every)\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/i.test(text)
    || /\b(hourly|daily|weekly)\b/i.test(text)
    || /\b(after|gap of|interval of)\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/i.test(text);
}

function extractRepeatIntervalMinutes(text: string): number | null {
  const clean = normalizeSprint3M3Text(text);
  const every = clean.match(/\b(?:repeats?\s+)?every\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/i);
  if (every) {
    const value = Number(every[1]);
    const unit = every[2].toLowerCase();
    return unit.startsWith("hour") || unit.startsWith("hr") ? value * 60 : value;
  }
  const after = clean.match(/\b(?:after|gap of|interval of)\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/i);
  if (after && /\b(repeat|repeating|repetition|interval|gap)\b/i.test(clean)) {
    const value = Number(after[1]);
    const unit = after[2].toLowerCase();
    return unit.startsWith("hour") || unit.startsWith("hr") ? value * 60 : value;
  }
  if (/\bhourly\b/i.test(clean)) return 60;
  return null;
}

function extractStartDelayMinutes(text: string): number | null {
  const clean = normalizeSprint3M3Text(text);
  const match = clean.match(/\b(?:starting\s+)?(?:in|after|from now|starting in)\s*(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)(?:\s+from now)?\b/i)
    || clean.match(/\b(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\s+from now\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit.startsWith("hour") || unit.startsWith("hr") ? value * 60 : value;
}

function buildDueAt(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

function formatRelativeTime(minutes: number): string {
  if (minutes === 1) return "1 minute from now";
  if (minutes < 60) return `${minutes} minutes from now`;
  if (minutes === 60) return "1 hour from now";
  return `${Math.round(minutes / 60)} hours from now`;
}

function formatLocalTime(now: Date, minutes: number): string {
  const d = new Date(now.getTime() + minutes * 60_000);
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const h12 = hours % 12 || 12;
  return `${h12}:${mins} ${ampm}`;
}

function labelForInterval(minutes: number, todayOnly: boolean): string {
  let base: string;
  if (minutes === 60) base = "Repeats every 1 hour";
  else if (minutes % 60 === 0) base = `Repeats every ${minutes / 60} hours`;
  else if (minutes === 1) base = "Repeats every 1 minute";
  else base = `Repeats every ${minutes} minutes`;
  return todayOnly ? `${base} · today only` : base;
}

function ensureDraft(input: string, activeDraft: Sprint3M3Draft | null | undefined): Sprint3M3Draft {
  return {
    task: activeDraft?.task || "Alarm",
    rawText: activeDraft?.rawText ? `${activeDraft.rawText} | ${input}` : input,
    eventDatePhrase: activeDraft?.eventDatePhrase || "today",
    eventTimeText: activeDraft?.eventTimeText || "",
    eventAt: activeDraft?.eventAt ?? null,
    alerts: activeDraft?.alerts || [],
    category: activeDraft?.category || "General",
    pendingAmbiguousTime: activeDraft?.pendingAmbiguousTime ?? null,
    pendingInferenceConfirmation: activeDraft?.pendingInferenceConfirmation ?? null,
    lastQuestion: activeDraft?.lastQuestion ?? null,
    repeatRule: activeDraft?.repeatRule || null,
    isAlarm: activeDraft?.isAlarm ?? true,
    pendingRepeatQuestion: activeDraft?.pendingRepeatQuestion || null,
    ...activeDraft,
  };
}

export function resolveSprint3M3RepeatClarification(
  inputText: string,
  activeDraft?: Sprint3M3Draft | null,
  now: Date = new Date(),
): Sprint3M3Resolution {
  const clean = normalizeSprint3M3Text(inputText);

  if (isSprint3M3CancelDraftText(clean)) {
    return {
      handled: true,
      draft: null,
      message: "No problem — I cleared the current draft. Tell me the next reminder when ready.",
      readyToConfirm: false,
      clearDraft: true,
    };
  }

  const repeatIntent = isRepeatIntent(clean) || activeDraft?.pendingRepeatQuestion === "repeat_kind" || activeDraft?.pendingRepeatQuestion === "repeat_interval";
  if (!repeatIntent) {
    return { handled: false, draft: activeDraft || null, message: "", readyToConfirm: false };
  }

  const draft = ensureDraft(clean, activeDraft);
  const todayOnly = hasTodayOnly(clean) || draft.repeatRule?.endDatePhrase === "today";
  const startDelayMinutes = extractStartDelayMinutes(clean);
  const intervalMinutes = extractRepeatIntervalMinutes(clean);

  // P0 3M.3 rule: "starting in X minutes" sets first start time only.
  // It must NOT become the repeat gap unless the user explicitly says "every X minutes".
  if (startDelayMinutes !== null && !hasRepeatInterval(clean) && !draft.repeatRule?.intervalMinutes) {
    const dueAt = buildDueAt(now, startDelayMinutes);
    const timeText = formatLocalTime(now, startDelayMinutes);
    const updated: Sprint3M3Draft = {
      ...draft,
      eventDatePhrase: "today",
      eventTimeText: formatRelativeTime(startDelayMinutes),
      alerts: [{ datePhrase: "today", timeText, dueAt, approximate: false }],
      pendingRepeatQuestion: "repeat_interval",
      repeatRule: null,
      isAlarm: isAlarmIntent(clean) || draft.isAlarm || true,
    };
    return {
      handled: true,
      draft: updated,
      message: `Got it — the first ${updated.isAlarm ? "alarm" : "reminder"} will start in ${formatRelativeTime(startDelayMinutes)} today. How often should it repeat after that? For example: every 30 minutes, every 1 hour, or daily.`,
      readyToConfirm: false,
    };
  }

  // User is answering the pending repeat interval question.
  if (draft.pendingRepeatQuestion === "repeat_interval" && intervalMinutes !== null) {
    const currentAlert = draft.alerts?.[0];
    const updated: Sprint3M3Draft = {
      ...draft,
      repeatRule: {
        kind: intervalMinutes === 60 ? "hourly" : "interval",
        intervalMinutes,
        label: labelForInterval(intervalMinutes, todayOnly),
        endDatePhrase: todayOnly ? "today" : undefined,
      },
      pendingRepeatQuestion: null,
      alerts: currentAlert ? [currentAlert] : draft.alerts || [],
    };
    return {
      handled: true,
      draft: updated,
      message: `Perfect — ${updated.task || "Alarm"}, ${updated.eventDatePhrase || "today"}, reminder time ${updated.alerts?.[0]?.timeText || updated.eventTimeText}. ${updated.repeatRule?.label}. Should I save this reminder, adjust it, or drop it?`,
      readyToConfirm: true,
    };
  }

  // Compound phrase with both first start and explicit repeat interval.
  if (startDelayMinutes !== null && intervalMinutes !== null) {
    const dueAt = buildDueAt(now, startDelayMinutes);
    const timeText = formatLocalTime(now, startDelayMinutes);
    const updated: Sprint3M3Draft = {
      ...draft,
      eventDatePhrase: "today",
      eventTimeText: formatRelativeTime(startDelayMinutes),
      alerts: [{ datePhrase: "today", timeText, dueAt, approximate: false }],
      repeatRule: {
        kind: intervalMinutes === 60 ? "hourly" : "interval",
        intervalMinutes,
        label: labelForInterval(intervalMinutes, todayOnly),
        endDatePhrase: todayOnly ? "today" : undefined,
      },
      pendingRepeatQuestion: null,
      isAlarm: isAlarmIntent(clean) || draft.isAlarm || true,
    };
    return {
      handled: true,
      draft: updated,
      message: `Perfect — ${updated.task || "Alarm"}, today, reminder time ${timeText}. ${updated.repeatRule?.label}. Should I save this reminder, adjust it, or drop it?`,
      readyToConfirm: true,
    };
  }

  // User said only "today only" while system is waiting for repeat kind/interval.
  if (todayOnly && draft.pendingRepeatQuestion) {
    const updated: Sprint3M3Draft = {
      ...draft,
      pendingRepeatQuestion: "repeat_interval",
      repeatRule: null,
    };
    return {
      handled: true,
      draft: updated,
      message: "Got it — today only. How often should it repeat until today ends? For example: every 30 minutes or every 1 hour.",
      readyToConfirm: false,
    };
  }

  return { handled: false, draft: activeDraft || null, message: "", readyToConfirm: false };
}
