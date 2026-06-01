import { applyTimeChange, type ReminderDraft, type RepeatRule } from "./reminderDraftReducers";

export type RepeatClarificationResolution = {
  handled: boolean;
  draft: ReminderDraft;
  message: string;
  readyToConfirm: boolean;
};

type ParsedRepeatClarification = {
  intervalMinutes?: number;
  repeatKind?: "hourly" | "daily" | "weekly" | "custom";
  repeatLabel?: string;
  firstDuePhrase?: string;
  endDatePhrase?: "today";
  explicitCancelRepeat?: boolean;
};

/**
 * Handles MiniViktor's repeat clarification state.
 *
 * Primary bug closed:
 * - activeDraft.pendingRepeatQuestion === "repeat_kind"
 * - user provides interval/start/end-scope in natural speech
 * - old behavior loops: "Should this repeat daily or weekly..."
 * - new behavior merges the information into the active draft
 */
export function resolveRepeatClarification(
  activeDraft: ReminderDraft,
  userText: string,
  now: Date = new Date()
): RepeatClarificationResolution {
  const normalized = normalizeRepeatSpeech(userText);
  const isRepeatDraft = Boolean(activeDraft?.isAlarm || activeDraft?.pendingRepeatQuestion || /repeat/i.test(activeDraft?.rawText || ""));

  if (!activeDraft || !isRepeatDraft) {
    return { handled: false, draft: activeDraft, message: "", readyToConfirm: false };
  }

  const parsed = parseRepeatClarification(normalized);

  if (!hasRepeatSignal(parsed) && activeDraft.pendingRepeatQuestion !== "repeat_kind") {
    return { handled: false, draft: activeDraft, message: "", readyToConfirm: false };
  }

  let updated: ReminderDraft = {
    ...activeDraft,
    rawText: appendRaw(activeDraft.rawText, userText),
    pendingRepeatQuestion: null,
    lastQuestion: "confirm",
  };

  if (parsed.explicitCancelRepeat) {
    updated = {
      ...updated,
      repeatRule: null,
      pendingRepeatQuestion: null,
    };
    return {
      handled: true,
      draft: updated,
      readyToConfirm: true,
      message: `Got it — this will not repeat. ${formatDraft(updated)} Should I save this reminder, adjust it, or drop it?`,
    };
  }

  if (parsed.firstDuePhrase) {
    updated = applyTimeChange(updated, parsed.firstDuePhrase, now);
    updated = { ...updated, pendingRepeatQuestion: null, lastQuestion: "confirm" };
  }

  const repeatRule = mergeRepeatRule(updated.repeatRule || null, parsed);
  updated = { ...updated, repeatRule };

  const hasStart = Boolean(updated.alerts?.[0]?.dueAt || updated.alerts?.[0]?.timeText || updated.eventTimeText || parsed.firstDuePhrase);
  const hasInterval = Boolean(updated.repeatRule?.intervalMinutes || updated.repeatRule?.kind === "daily" || updated.repeatRule?.kind === "weekly");
  const hasTodayOnly = Boolean(updated.repeatRule?.endDatePhrase === "today");

  // If the user only said "today" / "today only", do not loop daily/weekly.
  // Ask for the missing pieces in a more precise way.
  if (hasTodayOnly && !hasInterval && !hasStart) {
    return {
      handled: true,
      draft: { ...updated, pendingRepeatQuestion: "repeat_interval_or_start" },
      readyToConfirm: false,
      message: "Got it — today only. When should the first alarm start, and how often should it repeat? For example, ‘1 minute from now, every 1 hour.’",
    };
  }

  if (hasInterval && !hasStart) {
    return {
      handled: true,
      draft: { ...updated, pendingRepeatQuestion: "repeat_start_time" },
      readyToConfirm: false,
      message: `${formatRepeatOnly(updated.repeatRule)}. When should the first alarm start? You can say “1 minute from now” or “at 10 pm”.`,
    };
  }

  if (hasStart && !hasInterval) {
    return {
      handled: true,
      draft: { ...updated, pendingRepeatQuestion: "repeat_interval" },
      readyToConfirm: false,
      message: `Got it — first alarm ${formatStart(updated)}. How often should it repeat? For example, every 1 hour, daily, or weekly.`,
    };
  }

  return {
    handled: true,
    draft: updated,
    readyToConfirm: true,
    message: `${formatDraft(updated)} Should I save this reminder, adjust it, or drop it?`,
  };
}

export function normalizeRepeatSpeech(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\breceives?\s+every\s+one\b/g, "repeats every 1 hour")
    .replace(/\breceives?\s+everyone\b/g, "repeats every 1 hour")
    .replace(/\brepeat(?:s|ers)?\s+every\s+one\b/g, "repeats every 1 hour")
    .replace(/\brepeat(?:s|ers)?\s+everyone\b/g, "repeats every 1 hour")
    .replace(/\brepeats?\s+after\s+everyone\b/g, "repeats every 1 hour")
    .replace(/\brepeat(?:s|ers)?\s+after\s+every\s+one\b/g, "repeats every 1 hour")
    .replace(/\bafter\s+everyone\b/g, "every 1 hour")
    .replace(/\beveryone\b/g, "every 1 hour")
    .replace(/\bevery\s+one\b/g, "every 1 hour")
    .replace(/\bring should be\b/g, "first alarm")
    .replace(/\balarm is for\b/g, "first alarm")
    .replace(/\balarm should be for\b/g, "first alarm")
    .replace(/\brepetition should be\b/g, "repeat")
    .replace(/\brepeaters?\b/g, "repeat")
    .trim();
}

export function parseRepeatClarification(normalizedText: string): ParsedRepeatClarification {
  const parsed: ParsedRepeatClarification = {};

  if (/\b(no repeat|do not repeat|don't repeat|dont repeat|one time only|only once)\b/.test(normalizedText)) {
    parsed.explicitCancelRepeat = true;
    return parsed;
  }

  if (/\b(today only|only today|for today only|today alone)\b/.test(normalizedText)) {
    parsed.endDatePhrase = "today";
  }

  const minuteInterval = normalizedText.match(/\b(?:every|after|repeat(?:s)? every|repeat(?:s)? after)\s+(\d+)\s+minutes?\b/);
  const hourInterval = normalizedText.match(/\b(?:every|after|repeat(?:s)? every|repeat(?:s)? after)\s+(\d+)\s+hours?\b/);

  if (minuteInterval?.[1]) {
    parsed.intervalMinutes = Number(minuteInterval[1]);
    parsed.repeatKind = "custom";
    parsed.repeatLabel = `Repeats every ${Number(minuteInterval[1])} minute${Number(minuteInterval[1]) === 1 ? "" : "s"}`;
  } else if (hourInterval?.[1]) {
    const hours = Number(hourInterval[1]);
    parsed.intervalMinutes = hours * 60;
    parsed.repeatKind = hours === 1 ? "hourly" : "custom";
    parsed.repeatLabel = `Repeats every ${hours} hour${hours === 1 ? "" : "s"}`;
  } else if (/\bhourly\b/.test(normalizedText)) {
    parsed.intervalMinutes = 60;
    parsed.repeatKind = "hourly";
    parsed.repeatLabel = "Repeats every 1 hour";
  } else if (/\bdaily\b/.test(normalizedText)) {
    parsed.intervalMinutes = 1440;
    parsed.repeatKind = "daily";
    parsed.repeatLabel = "Repeats daily";
  } else if (/\bweekly\b/.test(normalizedText)) {
    parsed.intervalMinutes = 10080;
    parsed.repeatKind = "weekly";
    parsed.repeatLabel = "Repeats weekly";
  }

  const relativeStart = normalizedText.match(/\b(?:first alarm\s*)?(?:in\s+)?(\d+)\s+minutes?\s+from\s+now\b|\b(\d+)\s+minute\s+from\s+now\b|\bminute\s+from\s+now\b/);
  if (relativeStart) {
    const amount = relativeStart[1] || relativeStart[2] || "1";
    parsed.firstDuePhrase = `${amount} minute${amount === "1" ? "" : "s"} from now`;
  }

  const absoluteStart = normalizedText.match(/\b(?:first alarm|start|ring|alarm)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/);
  if (!parsed.firstDuePhrase && absoluteStart?.[1]) {
    parsed.firstDuePhrase = absoluteStart[1];
  }

  return parsed;
}

function mergeRepeatRule(existing: RepeatRule | undefined, parsed: ParsedRepeatClarification): NonNullable<RepeatRule> {
  const base: NonNullable<RepeatRule> = existing || {};
  let label = parsed.repeatLabel || base.label;

  if (parsed.endDatePhrase === "today") {
    label = label ? appendTodayOnly(label) : "Repeats · today only";
  }

  return {
    ...base,
    kind: parsed.repeatKind || base.kind,
    intervalMinutes: parsed.intervalMinutes || base.intervalMinutes,
    label,
    endDatePhrase: parsed.endDatePhrase || base.endDatePhrase,
  };
}

function hasRepeatSignal(parsed: ParsedRepeatClarification): boolean {
  return Boolean(parsed.intervalMinutes || parsed.repeatKind || parsed.firstDuePhrase || parsed.endDatePhrase || parsed.explicitCancelRepeat);
}

function appendTodayOnly(label: string): string {
  return /today only/i.test(label) ? label : `${label} · today only`;
}

function formatDraft(draft: ReminderDraft): string {
  const title = draft.task || "Alarm";
  const date = draft.eventDatePhrase || draft.alerts?.[0]?.datePhrase || "today";
  const time = draft.alerts?.[0]?.timeText || draft.eventTimeText || "the selected time";
  const repeat = draft.repeatRule?.label ? ` ${draft.repeatRule.label}.` : "";
  return `Perfect — ${title}, ${date}, reminder time ${time}.${repeat}`;
}

function formatRepeatOnly(rule: RepeatRule | undefined): string {
  return rule?.label || "Got it — this is a repeating alarm";
}

function formatStart(draft: ReminderDraft): string {
  return draft.alerts?.[0]?.timeText || draft.eventTimeText || "at the selected time";
}

function appendRaw(existing: string | undefined, addition: string): string {
  const cleanAddition = addition.trim();
  if (!existing) return cleanAddition;
  if (!cleanAddition) return existing;
  return `${existing} | ${cleanAddition}`;
}
