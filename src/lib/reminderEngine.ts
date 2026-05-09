import type {
  EngineResult,
  LearningMemory,
  Reminder,
  ReminderAlert,
  ReminderCategory,
  ReminderDraft,
  SaveResult,
} from "./reminderTypes";
import { classifyMiniViktorIntent, normaliseWithMiniViktor } from "../brain/miniViktorIntentEngine";

const MS_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_LEARNING_MEMORY: LearningMemory = {
  categoryPatterns: {},
  ampmPatterns: {},
  softTimePatterns: {},
};

function safeId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fallback below
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createEmptyDraft(): ReminderDraft {
  return {
    id: safeId(),
    task: "",
    rawText: "",
    eventDateISO: null,
    eventDatePhrase: "",
    eventTimeText: "",
    eventAt: null,
    alerts: [],
    category: "General",
    pendingAmbiguousTime: null,
    pendingInferenceConfirmation: null,
    lastQuestion: null,
  };
}

export function normaliseInput(input: string) {
  return normaliseWithMiniViktor(input);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateOnlyISO(date: Date) {
  return startOfDay(date).toISOString();
}

function sameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getOrdinal(day: number) {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function datePhrase(date: Date, assumed = false) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today.getTime() + MS_DAY);

  if (sameDate(date, today)) return "today";
  if (sameDate(date, tomorrow)) return "tomorrow";
  if (assumed) return `the coming ${getOrdinal(date.getDate())}`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateLabel(date: Date) {
  const phrase = datePhrase(date);
  if (phrase === "today") return "Today";
  if (phrase === "tomorrow") return "Tomorrow";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(hour: number, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).toLowerCase();
}

function combineDateAndTime(dateISO: string, hour: number, minute = 0) {
  const date = new Date(dateISO);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function parseWeekday(text: string): Date | null {
  const lower = text.toLowerCase();
  const match = lower.match(/\b(this\s+|next\s+)?(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)\b/);
  if (!match) return null;

  const weekdayMap: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  const today = startOfDay(new Date());
  const current = today.getDay();
  const target = weekdayMap[match[2]];
  let add = target - current;

  if (match[1]?.trim() === "next" || add <= 0) {
    add += 7;
  }

  return new Date(today.getTime() + add * MS_DAY);
}

function parseDate(text: string): { date: Date; assumed?: boolean } | null {
  const lower = normaliseInput(text).toLowerCase();
  const today = startOfDay(new Date());

  if (/\bday after tomorrow\b/.test(lower)) {
    return { date: new Date(today.getTime() + 2 * MS_DAY) };
  }

  if (/\btomorrow\b/.test(lower)) {
    return { date: new Date(today.getTime() + MS_DAY) };
  }

  if (/\btoday\b/.test(lower)) {
    return { date: today };
  }

  const weekday = parseWeekday(lower);
  if (weekday) return { date: weekday };

  const ordinalMatch =
    lower.match(/\b(?:on\s+|the\s+)?(\d{1,2})(st|nd|rd|th)\b/) ||
    lower.match(/\bon\s+(\d{1,2})\b/);

  if (ordinalMatch) {
    const day = Number(ordinalMatch[1]);
    if (day >= 1 && day <= 31) {
      const possible = startOfDay(new Date());
      possible.setDate(day);
      if (possible < today) possible.setMonth(possible.getMonth() + 1);
      return { date: possible, assumed: true };
    }
  }

  return null;
}

type TimeToken = {
  raw: string;
  hour: number;
  minute: number;
  period: "am" | "pm" | null;
  hasPeriod: boolean;
  approximate?: boolean;
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function parseOneTimeToken(text: string): TimeToken | null {
  const lower = text.toLowerCase();

  if (/\bnoon\b/.test(lower)) {
    return { raw: "noon", hour: 12, minute: 0, period: "pm", hasPeriod: true };
  }

  if (/\bmidnight\b/.test(lower)) {
    return { raw: "midnight", hour: 12, minute: 0, period: "am", hasPeriod: true };
  }

  const approxPrefix = /\b(around|about|approx|approximately|near|roughly|somewhere around)\b/.test(lower);
  const numeric = lower.match(/\b(?:at\s*)?(\d{1,2})(?:(?:\:|\.)(\d{1,2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:ish|-ish)?\b/);

  if (numeric) {
    const hour = Number(numeric[1]);
    const minute = numeric[2] ? Number(numeric[2].padEnd(2, "0").slice(0, 2)) : 0;
    const period = numeric[3] ? (numeric[3].replace(/\./g, "") as "am" | "pm") : null;
    const approximate = approxPrefix || /ish|-ish/.test(numeric[0]);
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      return {
        raw: numeric[0],
        hour,
        minute,
        period,
        hasPeriod: Boolean(period),
        approximate,
      };
    }
  }

  const wordMatch = lower.match(/\b(around|about|approx|approximately|near|roughly|somewhere around)?\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*|-)?(ish)?\s*(am|pm)?\b/);
  if (wordMatch) {
    const hour = WORD_NUMBERS[wordMatch[2]];
    const period = wordMatch[4] ? (wordMatch[4] as "am" | "pm") : null;
    return {
      raw: wordMatch[0],
      hour,
      minute: 0,
      period,
      hasPeriod: Boolean(period),
      approximate: Boolean(wordMatch[1] || wordMatch[3]),
    };
  }

  if (/\bmorning\b/.test(lower)) return { raw: "morning", hour: 9, minute: 0, period: "am", hasPeriod: true, approximate: true };
  if (/\bafternoon\b/.test(lower)) return { raw: "afternoon", hour: 2, minute: 0, period: "pm", hasPeriod: true, approximate: true };
  if (/\bevening\b/.test(lower)) return { raw: "evening", hour: 6, minute: 0, period: "pm", hasPeriod: true, approximate: true };
  if (/\bnight\b/.test(lower)) return { raw: "night", hour: 9, minute: 0, period: "pm", hasPeriod: true, approximate: true };

  return null;
}

function extractTimeTokens(text: string): TimeToken[] {
  const normalised = normaliseInput(text);
  const tokens: TimeToken[] = [];

  const regex = /\b(?:around|about|approx|approximately|near|roughly|somewhere around)?\s*(?:at\s*)?(\d{1,2})(?:(?:\:|\.)(\d{1,2}))?\s*(?:am|pm|a\.m\.|p\.m\.)?\s*(?:ish|-ish)?\b|\b(?:around|about|near)?\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*|-)?(?:ish)?\s*(?:am|pm)?\b|\b(noon|midnight|morning|afternoon|evening|night)\b/gi;

  const matches = Array.from(normalised.matchAll(regex));
  for (const match of matches) {
    const parsed = parseOneTimeToken(match[0]);
    if (parsed) tokens.push(parsed);
  }

  return tokens;
}

function hasDinnerContext(text: string) {
  return /\b(dinner|party|night|evening)\b/i.test(text);
}

function hasMorningContext(text: string) {
  return /\b(breakfast|morning|school)\b/i.test(text);
}

function resolveBareTimeCandidates(token: TimeToken) {
  const amCandidate = token.hour === 12 ? 0 : token.hour;
  const pmCandidate = token.hour === 12 ? 12 : token.hour + 12;

  if (amCandidate === pmCandidate) return [amCandidate];
  return [amCandidate, pmCandidate];
}

function isSameLocalDateISO(dateISO: string | null | undefined, compareTo: Date) {
  if (!dateISO) return false;
  return sameDate(new Date(dateISO), compareTo);
}

function candidateDateTime(dateISO: string | null | undefined, hour: number, minute: number) {
  if (!dateISO) return null;
  return combineDateAndTime(dateISO, hour, minute);
}

function to24Hour(token: TimeToken, context: {
  phrase?: string;
  eventHour?: number | null;
  eventDateISO?: string | null;
  alertDateISO?: string | null;
  inheritPeriod?: "am" | "pm" | null;
  now?: Date;
}): { hour: number; minute: number; needsAMPM: boolean; inferred?: boolean; inferredReason?: "event_context" | "device_clock" | "phrase_context" } {
  if (token.period) {
    let hour = token.hour;
    if (token.period === "pm" && hour < 12) hour += 12;
    if (token.period === "am" && hour === 12) hour = 0;
    return { hour, minute: token.minute, needsAMPM: false, inferred: false };
  }

  if (context.inheritPeriod) {
    let hour = token.hour;
    if (context.inheritPeriod === "pm" && hour < 12) hour += 12;
    if (context.inheritPeriod === "am" && hour === 12) hour = 0;
    return { hour, minute: token.minute, needsAMPM: false, inferred: false };
  }

  const now = context.now || new Date();
  const candidates = resolveBareTimeCandidates(token);
  const futureCandidates = candidates.filter((hour) => {
    const candidate = candidateDateTime(context.alertDateISO, hour, token.minute);
    if (!candidate) return true;
    if (!isSameLocalDateISO(context.alertDateISO, now)) return true;
    return candidate.getTime() > now.getTime();
  });

  if (context.eventHour !== null && context.eventHour !== undefined) {
    const alertDate = context.alertDateISO ? new Date(context.alertDateISO) : null;
    const eventDate = context.eventDateISO ? new Date(context.eventDateISO) : null;
    // Highest-priority MiniViktor rule: when an event time exists, a bare
    // reminder time should be resolved against the event context before asking
    // AM/PM. If the selected time is already in the past, the past-time
    // guardrail will block saving later instead of silently changing meaning.
    if (alertDate && eventDate && sameDate(alertDate, eventDate)) {
      const beforeEventFuture = futureCandidates
        .filter((hour) => hour <= (context.eventHour as number))
        .sort((a, b) => Math.abs((context.eventHour as number) - a) - Math.abs((context.eventHour as number) - b));

      if (beforeEventFuture.length > 0) {
        return { hour: beforeEventFuture[0], minute: token.minute, needsAMPM: false, inferred: true, inferredReason: "event_context" };
      }

      const beforeEventAny = candidates
        .filter((hour) => hour <= (context.eventHour as number))
        .sort((a, b) => Math.abs((context.eventHour as number) - a) - Math.abs((context.eventHour as number) - b));

      if (beforeEventAny.length > 0) {
        return { hour: beforeEventAny[0], minute: token.minute, needsAMPM: false, inferred: true, inferredReason: "event_context" };
      }
    }

    if ((context.eventHour as number) >= 12) {
      const pmCandidate = token.hour === 12 ? 12 : token.hour + 12;
      return { hour: pmCandidate, minute: token.minute, needsAMPM: false, inferred: true, inferredReason: "event_context" };
    }

    if ((context.eventHour as number) < 12) {
      const amCandidate = token.hour === 12 ? 0 : token.hour;
      return { hour: amCandidate, minute: token.minute, needsAMPM: false, inferred: true, inferredReason: "event_context" };
    }
  }

  if (context.phrase && hasDinnerContext(context.phrase)) {
    const hour = token.hour === 12 ? 12 : token.hour + 12;
    return { hour, minute: token.minute, needsAMPM: false, inferred: false };
  }

  if (context.phrase && hasMorningContext(context.phrase)) {
    const hour = token.hour === 12 ? 0 : token.hour;
    return { hour, minute: token.minute, needsAMPM: false, inferred: false };
  }

  if (futureCandidates.length === 1) {
    return { hour: futureCandidates[0], minute: token.minute, needsAMPM: false, inferred: true, inferredReason: "device_clock" };
  }

  return { hour: token.hour, minute: token.minute, needsAMPM: true, inferred: false };
}

function getEventHour(draft: ReminderDraft) {
  if (!draft.eventAt) return null;
  return new Date(draft.eventAt).getHours();
}

function getPeriodFromToken(token: TimeToken, resolvedHour: number): "am" | "pm" | null {
  if (token.period) return token.period;
  if (resolvedHour >= 12) return "pm";
  return "am";
}

function offsetMinutes(text: string): number | null {
  const lower = text.toLowerCase();

  if (/\bhalf an hour before\b|\bhalf hour before\b/.test(lower)) return 30;
  if (/\ban hour before\b|\bone hour before\b|\b1 hour before\b/.test(lower)) return 60;
  if (/\bquarter of an hour before\b/.test(lower)) return 15;

  const minutes = lower.match(/\b(\d{1,3})\s*(minutes|minute|mins|min)\s+before\b/);
  if (minutes) return Number(minutes[1]);

  const hours = lower.match(/\b(\d{1,2})\s*(hours|hour|hrs|hr)\s+before\b/);
  if (hours) return Number(hours[1]) * 60;

  return null;
}

function deriveCategory(text: string, learning?: LearningMemory): ReminderCategory {
  const lower = text.toLowerCase();

  let best: { category: ReminderCategory; acceptedCount: number } | null = null;
  if (learning) {
    for (const [phrase, record] of Object.entries(learning.categoryPatterns)) {
      if (lower.includes(phrase.toLowerCase())) {
        if (!best || record.acceptedCount > best.acceptedCount) best = record;
      }
    }
  }

  if (best && best.acceptedCount >= 2) return best.category;

  const dictionary: Array<[ReminderCategory, string[]]> = [
    ["Work", ["boss", "client", "office", "meeting", "project", "interview", "presentation", "report", "sales", "team"]],
    ["Health", ["doctor", "medicine", "meds", "tablet", "gym", "walk", "exercise", "health", "hospital", "appointment"]],
    ["Finance", ["bill", "payment", "emi", "bank", "salary", "invoice", "tax", "rent", "recharge", "electricity"]],
    ["Family", ["mom", "mother", "dad", "father", "wife", "husband", "son", "daughter", "family", "parents"]],
    ["Social", ["lunch", "dinner", "party", "friend", "date", "rohan", "zuzu"]],
    ["Travel", ["flight", "train", "trip", "hotel", "airport", "delhi", "travel", "pack"]],
    ["Home", ["ac", "electrician", "plumber", "repair", "clean", "grocery", "home"]],
  ];

  for (const [category, words] of dictionary) {
    if (words.some((word) => lower.includes(word))) return category;
  }

  return "General";
}

function stripNoiseFromTask(input: string) {
  let task = input;

  task = task
    .replace(/\b(remind me|reminder|need(?: a)? reminder|notify me|alert me)\b.*$/i, "")
    .replace(/\bbut need\b.*$/i, "")
    .replace(/\bhowever need\b.*$/i, "")
    .replace(/\bas .*?\bis at\s+\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/i, "")
    .replace(/\b(today|tomorrow|day after tomorrow)\b/gi, "")
    .replace(/\b(this\s+|next\s+)?(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)\b/gi, "")
    .replace(/\bon\s+\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\bthe\s+\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\bat\s+\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/gi, "")
    .replace(/\b\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi, "")
    .replace(/\bhalf an hour before\b|\bhalf hour before\b|\ban hour before\b|\bone hour before\b|\bquarter of an hour before\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(reminder|remind me|set reminder)$/i.test(task)) return "";
  return task;
}

function titleFromAsCommand(input: string) {
  const match = input.match(/\b(?:save it as|call it|make it|name it)\s+(.+)$/i);
  if (!match) return null;
  return stripNoiseFromTask(match[1]) || match[1].trim();
}

function extractReminderSegment(input: string): string | null {
  const match = input.match(/\b(?:remind me|reminder|need(?: a)? reminder|notify me|alert me)\b(.*)$/i);
  if (!match) return null;
  return match[1].trim();
}

function explicitEventTime(input: string, draft: ReminderDraft): TimeToken | null {
  const lower = input.toLowerCase();
  const asMatch = lower.match(/\bas .*?\bis at\s+(.+)$/i);
  if (asMatch) return parseOneTimeToken(asMatch[1]);

  const reminderSegment = extractReminderSegment(input);
  const beforeReminder = reminderSegment ? input.slice(0, input.toLowerCase().indexOf(reminderSegment.toLowerCase())) : input;

  const tokens = extractTimeTokens(beforeReminder);
  if (tokens.length > 0) return tokens[0];

  if (!draft.eventTimeText && !reminderSegment) {
    const all = extractTimeTokens(input);
    return all[0] || null;
  }

  return null;
}

function applyEventTime(draft: ReminderDraft, token: TimeToken, sourcePhrase: string): ReminderDraft {
  const dateISO = draft.eventDateISO;
  const resolved = to24Hour(token, { phrase: sourcePhrase, alertDateISO: dateISO, now: new Date() });

  if (resolved.needsAMPM) {
    return {
      ...draft,
      pendingAmbiguousTime: {
        hour: token.hour,
        minute: token.minute,
        role: "event",
        dateISO,
        approximate: token.approximate,
      },
      lastQuestion: "ampm",
    };
  }

  const eventDateISO = dateISO || null;
  const eventAt = eventDateISO ? combineDateAndTime(eventDateISO, resolved.hour, resolved.minute).toISOString() : null;

  return {
    ...draft,
    eventTimeText: formatTime(resolved.hour, resolved.minute),
    eventAt,
    pendingAmbiguousTime: null,
  };
}

function createAlert(dateISO: string, hour: number, minute: number, approximate = false, inferredPeriod?: "am" | "pm", inferredReason?: "event_context" | "device_clock" | "phrase_context"): ReminderAlert {
  const due = combineDateAndTime(dateISO, hour, minute);
  return {
    id: safeId(),
    dateISO,
    dateLabel: dateLabel(due),
    datePhrase: datePhrase(due),
    timeText: `${approximate ? "around " : ""}${formatTime(hour, minute)}`,
    dueAt: due.toISOString(),
    approximate,
    inferredPeriod,
    inferredReason,
  };
}

function splitReminderParts(segment: string) {
  return segment
    .replace(/\band then\b/gi, " and ")
    .replace(/\bthen\b/gi, " and ")
    .replace(/&/g, " and ")
    .replace(/,/g, " and ")
    .split(/\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function countTimeBearingParts(segment: string) {
  return splitReminderParts(segment).reduce((count, part) => count + extractTimeTokens(part).length, 0);
}

function sortAlerts(alerts: ReminderAlert[]) {
  return [...alerts].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

function parseReminderAlertsFromText(
  segment: string,
  draft: ReminderDraft,
  globalDate: { date: Date; assumed?: boolean } | null,
  now = new Date()
): { alerts: ReminderAlert[]; pending?: ReminderDraft["pendingAmbiguousTime"] } {
  const parts = splitReminderParts(segment);
  const alerts: ReminderAlert[] = [];
  let inheritedPeriod: "am" | "pm" | null = null;
  let inheritedPeriodSource: "explicit" | "inferred" | null = null;
  let pending: ReminderDraft["pendingAmbiguousTime"] = null;

  const eventHour = getEventHour(draft);
  const defaultDateISO =
    globalDate ? dateOnlyISO(globalDate.date) : draft.eventDateISO || dateOnlyISO(new Date());

  for (const part of parts) {
    const partDate = parseDate(part);
    const dateISO = partDate ? dateOnlyISO(partDate.date) : defaultDateISO;
    const tokens = extractTimeTokens(part);
    if (tokens.length === 0) continue;

    for (const token of tokens) {
      const explicitInheritedPeriod: "am" | "pm" | null =
        !token.hasPeriod && inheritedPeriodSource === "explicit" ? inheritedPeriod : null;

      const resolved = to24Hour(token, {
        phrase: part,
        eventHour,
        eventDateISO: draft.eventDateISO,
        alertDateISO: dateISO,
        inheritPeriod: explicitInheritedPeriod,
        now,
      });

      if (resolved.needsAMPM) {
        pending = {
          hour: token.hour,
          minute: token.minute,
          role: "alert",
          dateISO,
          approximate: token.approximate,
        };
        continue;
      }

      const period = getPeriodFromToken(token, resolved.hour);
      const inferredPeriod =
        resolved.inferred && !token.hasPeriod && !explicitInheritedPeriod
          ? getPeriodFromToken(token, resolved.hour) || undefined
          : undefined;

      if (period) {
        inheritedPeriod = period;
        inheritedPeriodSource = token.hasPeriod || explicitInheritedPeriod ? "explicit" : "inferred";
      }

      alerts.push(createAlert(
        dateISO,
        resolved.hour,
        resolved.minute,
        Boolean(token.approximate),
        inferredPeriod,
        inferredPeriod ? resolved.inferredReason || "event_context" : undefined
      ));
    }
  }

  return { alerts: sortAlerts(alerts), pending };
}

function applyBeforeOffset(draft: ReminderDraft, sourceText: string): ReminderDraft {
  const minutes = offsetMinutes(sourceText);
  if (!minutes || !draft.eventAt) return draft;

  const event = new Date(draft.eventAt);
  const alert = new Date(event.getTime() - minutes * 60 * 1000);
  return {
    ...draft,
    alerts: [
      {
        id: safeId(),
        dateISO: dateOnlyISO(alert),
        dateLabel: dateLabel(alert),
        datePhrase: datePhrase(alert),
        timeText: formatTime(alert.getHours(), alert.getMinutes()),
        dueAt: alert.toISOString(),
      },
    ],
  };
}

function hasPastAlert(alerts: ReminderAlert[]) {
  const now = Date.now();
  return alerts.some((alert) => new Date(alert.dueAt).getTime() <= now);
}

function missingSlots(draft: ReminderDraft) {
  const missing: string[] = [];
  if (!draft.task.trim()) missing.push("what the reminder is about");
  if (draft.eventTimeText && !draft.eventDateISO) missing.push("the event day");
  if (!draft.eventDateISO && draft.alerts.length === 0) missing.push("the day");
  if (draft.pendingAmbiguousTime) missing.push("AM or PM");
  if (draft.pendingInferenceConfirmation) missing.push("confirmation for inferred AM/PM");
  if (draft.alerts.length === 0 && !draft.pendingAmbiguousTime) missing.push("the reminder time");
  return missing;
}

function finaliseDefaultAlertIfPossible(draft: ReminderDraft) {
  if (draft.alerts.length > 0) return draft;
  if (!draft.eventDateISO || !draft.eventTimeText || !draft.eventAt) return draft;

  const event = new Date(draft.eventAt);
  return {
    ...draft,
    alerts: [createAlert(draft.eventDateISO, event.getHours(), event.getMinutes())],
  };
}

function parseFormattedTimeText(timeText: string): { hour: number; minute: number } | null {
  const clean = timeText.toLowerCase().replace(/around\s+/g, "").trim();
  const match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const period = match[3] as "am" | "pm";

  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

function updateEventAtIfPossible(draft: ReminderDraft) {
  if (!draft.eventDateISO || !draft.eventTimeText) return draft;

  const parsedTime = draft.eventAt
    ? { hour: new Date(draft.eventAt).getHours(), minute: new Date(draft.eventAt).getMinutes() }
    : parseFormattedTimeText(draft.eventTimeText);

  if (!parsedTime) return draft;

  const eventDate = new Date(draft.eventDateISO);
  eventDate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);

  return {
    ...draft,
    eventAt: eventDate.toISOString(),
  };
}

function responseForDraft(draft: ReminderDraft): string {
  const missing = missingSlots(draft);

  if (draft.pendingAmbiguousTime) {
    return `Just confirming — do you mean ${formatTime(draft.pendingAmbiguousTime.hour, draft.pendingAmbiguousTime.minute).replace("am", "AM").replace("pm", "PM")} or ${formatTime(draft.pendingAmbiguousTime.hour + 12 <= 23 ? draft.pendingAmbiguousTime.hour + 12 : draft.pendingAmbiguousTime.hour, draft.pendingAmbiguousTime.minute).replace("am", "AM").replace("pm", "PM")}?`;
  }

  if (draft.pendingInferenceConfirmation) {
    const inferredAlerts = draft.alerts.filter((alert) =>
      draft.pendingInferenceConfirmation?.alertIds.includes(alert.id)
    );
    const alertText = inferredAlerts
      .map((alert) => `${alert.datePhrase} at ${alert.timeText}`)
      .join(" and ");
    const eventText = draft.eventAt
      ? `${draft.eventDatePhrase || datePhrase(new Date(draft.eventAt))} at ${draft.eventTimeText}`
      : "the event details you gave me";
    const reasonText = draft.pendingInferenceConfirmation.reason === "event_context"
      ? `because ${draft.task || "the event"} is ${eventText}`
      : draft.pendingInferenceConfirmation.reason === "device_clock"
        ? "based on your device clock"
        : "based on the phrase you used";

    return `I’m reading that as ${alertText} ${reasonText}. Is that correct?`;
  }

  if (!draft.task.trim()) {
    const datePart = draft.eventDatePhrase ? ` ${draft.eventDatePhrase}` : "";
    const timePart = draft.eventTimeText ? ` at ${draft.eventTimeText}` : "";
    return `Sure — what should I remind you about${datePart}${timePart}?`;
  }

  if (missing.includes("the event day")) {
    const alertText = draft.alerts.length
      ? draft.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`).join(" and ")
      : "";
    return alertText
      ? `I have the reminder alert${draft.alerts.length > 1 ? "s" : ""} as ${alertText}. Which day is ${draft.task} itself at ${draft.eventTimeText}?`
      : `Which day is ${draft.task} at ${draft.eventTimeText}?`;
  }
  if (missing.includes("the day")) return "Sure — which day should I set this for?";
  if (missing.includes("the reminder time")) return "Got it. What time works for this reminder?";

  if (hasPastAlert(draft.alerts)) {
    return "One of those reminder times has already passed. Please choose a future time for that reminder.";
  }

  const eventText = draft.eventAt
    ? `${draft.eventDatePhrase || datePhrase(new Date(draft.eventAt))} at ${draft.eventTimeText}`
    : "";

  if (draft.alerts.length > 1) {
    const alertText = draft.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`).join(" and ");
    return draft.eventAt
      ? `Got it — ${draft.task} is ${eventText}. You want reminders ${alertText}. Should I save these reminders, adjust them, or drop them?`
      : `Got it — you want reminders ${alertText} for ${draft.task}. Should I save these reminders, adjust them, or drop them?`;
  }

  const alert = draft.alerts[0];
  const eventAndReminderSame =
    Boolean(draft.eventAt) &&
    new Date(draft.eventAt as string).getTime() === new Date(alert.dueAt).getTime();

  if (draft.eventAt && eventAndReminderSame) {
    return `${draft.task} is ${eventText}. I’ll remind you at the event time unless you want an earlier reminder. Should I save this reminder, adjust it, or drop it?`;
  }

  if (draft.eventAt && draft.eventTimeText !== alert.timeText.replace("around ", "")) {
    return `Got it — I’ll remind you about ${draft.task} ${alert.datePhrase} at ${alert.timeText}. The event is at ${draft.eventTimeText}. Should I save this reminder, adjust it, or drop it?`;
  }

  return `Perfect — ${draft.task}, ${alert.datePhrase}, reminder time ${alert.timeText}. Should I save this reminder, would you like to change something, or does this not work for you?`;
}

function cleanTextForTaskInput(input: string) {
  const directTitle = titleFromAsCommand(input);
  if (directTitle) return directTitle;
  return stripNoiseFromTask(input);
}

function isQuestionAboutMissing(text: string) {
  return /\b(what detail|what do you need|which detail|what else)\b/i.test(text);
}

export function isSaveIntent(text: string) {
  return /^(yes|save|save it|save reminder|looks good|go ahead|ok|okay|done|perfect)$/i.test(text.trim());
}

export function isCancelIntent(text: string) {
  return /^(no|cancel|drop|drop it|not needed|doesn't work|doesnt work|doesn’t work)$/i.test(text.trim());
}

export function isChangeIntent(text: string) {
  return /^(change|change it|edit|edit it|adjust|adjust it|tweak|modify)$/i.test(text.trim());
}

function isAffirmation(text: string) {
  return /^(yes|yeah|yep|correct|right|that is correct|looks good|ok|okay)$/i.test(text.trim());
}

function applyDate(draft: ReminderDraft, dateResult: { date: Date; assumed?: boolean }) {
  const dateISO = dateOnlyISO(dateResult.date);
  const phrase = datePhrase(dateResult.date, dateResult.assumed);

  let next: ReminderDraft = {
    ...draft,
    eventDateISO: dateISO,
    eventDatePhrase: phrase,
  };

  next = updateEventAtIfPossible(next);

  if (next.alerts.length === 0 && next.eventAt) {
    next = finaliseDefaultAlertIfPossible(next);
  }

  return next;
}

function applyAMPM(draft: ReminderDraft, input: string): ReminderDraft {
  if (!draft.pendingAmbiguousTime) return draft;

  const lower = input.toLowerCase();
  let period: "am" | "pm" | null = null;
  if (/\bpm\b|p\.m\./.test(lower)) period = "pm";
  if (/\bam\b|a\.m\./.test(lower)) period = "am";
  if (!period) return draft;

  let hour = draft.pendingAmbiguousTime.hour;
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  if (draft.pendingAmbiguousTime.role === "event") {
    let next: ReminderDraft = {
      ...draft,
      eventTimeText: formatTime(hour, draft.pendingAmbiguousTime.minute),
      pendingAmbiguousTime: null,
    };

    if (next.eventDateISO) {
      next.eventAt = combineDateAndTime(next.eventDateISO, hour, draft.pendingAmbiguousTime.minute).toISOString();
      next = finaliseDefaultAlertIfPossible(next);
    }

    return next;
  }

  const dateISO = draft.pendingAmbiguousTime.dateISO || draft.eventDateISO || dateOnlyISO(new Date());
  const alert = createAlert(dateISO, hour, draft.pendingAmbiguousTime.minute, draft.pendingAmbiguousTime.approximate);

  const existingAlerts = draft.alerts.filter((existing) => existing.dueAt !== alert.dueAt);

  return {
    ...draft,
    alerts: [...existingAlerts, alert].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    ),
    pendingAmbiguousTime: null,
  };
}

export function processUserText(
  currentDraft: ReminderDraft | null,
  userInput: string,
  learning?: LearningMemory,
  options?: { now?: Date }
): EngineResult {
  const input = normaliseInput(userInput);
  const now = options?.now || new Date();
  let draft = currentDraft ? { ...currentDraft, alerts: [...currentDraft.alerts] } : createEmptyDraft();
  const miniViktorIntent = classifyMiniViktorIntent(input, {
    hasDraft: Boolean(currentDraft),
    hasTask: Boolean(currentDraft?.task?.trim()),
    hasEventDate: Boolean(currentDraft?.eventDateISO),
    hasEventTime: Boolean(currentDraft?.eventTimeText),
    hasAlerts: Boolean(currentDraft?.alerts?.length),
    awaitingAMPM: Boolean(currentDraft?.pendingAmbiguousTime),
  });

  draft.rawText = [draft.rawText, input].filter(Boolean).join(" | ");
  let expectedAlertCandidateCount = 0;

  if (isQuestionAboutMissing(input)) {
    const missing = missingSlots(draft);
    const need = missing.length ? missing.join(" and ") : "nothing else";
    return {
      draft,
      assistantText: missing.length ? `I just need ${need}.` : "I have everything I need. Should I save it?",
      readyToSave: missing.length === 0,
    };
  }

  if (draft.pendingInferenceConfirmation && isAffirmation(input)) {
    draft = {
      ...draft,
      alerts: draft.alerts.map((alert) => ({
        ...alert,
        inferredPeriod: undefined,
        inferredReason: undefined,
      })),
      pendingInferenceConfirmation: null,
    };
    return {
      draft,
      assistantText: responseForDraft(draft),
      readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
    };
  }

  if (draft.pendingAmbiguousTime) {
    const applied = applyAMPM(draft, input);
    if (applied !== draft) {
      draft = applied;
      return {
        draft,
        assistantText: responseForDraft(draft),
        readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
      };
    }
  }

  const directTitle = titleFromAsCommand(input);
  if (directTitle) {
    draft.task = directTitle;
  }

  const parsedDate = parseDate(input);

  const reminderSegment = extractReminderSegment(input);
  const beforeOffset = offsetMinutes(input);
  const messageIsAlertInstruction =
    miniViktorIntent.primaryIntent === "multiple_dated_reminder_alerts" ||
    miniViktorIntent.primaryIntent === "multiple_reminder_alerts" ||
    miniViktorIntent.primaryIntent === "before_event_reminder" ||
    Boolean(currentDraft?.eventTimeText && (/\band\b|\bthen\b|,|&|\breminder\b|\bneed\b/i.test(input)));

  if (!directTitle) {
    const taskCandidate = cleanTextForTaskInput(input);
    const inputIsReminderAlertInstruction =
      miniViktorIntent.primaryIntent === "multiple_dated_reminder_alerts" ||
      miniViktorIntent.primaryIntent === "multiple_reminder_alerts" ||
      miniViktorIntent.primaryIntent === "before_event_reminder";

    if (taskCandidate && (!currentDraft || !draft.task.trim()) && !inputIsReminderAlertInstruction) {
      draft.task = taskCandidate;
    }
  }

  if (parsedDate && !messageIsAlertInstruction) {
    draft = applyDate(draft, parsedDate);
  }

  const eventToken = explicitEventTime(input, draft);
  const isPureReminderFollowUp = Boolean(currentDraft?.eventTimeText) && messageIsAlertInstruction;

  if (eventToken && !isPureReminderFollowUp) {
    draft = applyEventTime(draft, eventToken, input);
  }

  if (draft.pendingAmbiguousTime) {
    return {
      draft,
      assistantText: responseForDraft(draft),
      readyToSave: false,
    };
  }

  if (parsedDate && !messageIsAlertInstruction) {
    draft = updateEventAtIfPossible(draft);
  }

  if (beforeOffset && draft.eventAt) {
    draft = applyBeforeOffset(draft, input);
  } else {
    const segmentForAlerts =
      reminderSegment ||
      (isPureReminderFollowUp || messageIsAlertInstruction ? input : null);

    if (segmentForAlerts) {
      expectedAlertCandidateCount = countTimeBearingParts(segmentForAlerts);
      const parsedAlerts = parseReminderAlertsFromText(segmentForAlerts, draft, messageIsAlertInstruction ? null : parsedDate, now);
      if (parsedAlerts.alerts.length > 0) {
        draft.alerts = sortAlerts(parsedAlerts.alerts);

        // Do not infer the event date from reminder-alert dates.
        // Reminder dates and event date are different slots. If event time is
        // known but event date is missing, MiniViktor must ask for the event day
        // instead of guessing from the last reminder alert.
      }

      const inferredAlerts = draft.alerts.filter((alert) => alert.inferredPeriod && alert.inferredReason);
      if (inferredAlerts.length > 0 && !parsedAlerts.pending) {
        draft.pendingInferenceConfirmation = {
          alertIds: inferredAlerts.map((alert) => alert.id),
          reason: inferredAlerts[0].inferredReason || "event_context",
        };
      }

      if (parsedAlerts.pending) {
        draft.pendingAmbiguousTime = parsedAlerts.pending;
        draft.pendingInferenceConfirmation = null;
      }
    }
  }

  if (!draft.pendingAmbiguousTime) {
    draft = finaliseDefaultAlertIfPossible(draft);
  }

  draft.category = deriveCategory(`${draft.task} ${input}`, learning);
  draft.lastQuestion = missingSlots(draft).length ? null : "confirm";

  const hasCandidateCollapse =
    expectedAlertCandidateCount > 1 &&
    draft.alerts.length < expectedAlertCandidateCount &&
    !draft.pendingAmbiguousTime;

  if (hasCandidateCollapse) {
    return {
      draft,
      assistantText:
        "I detected more than one reminder time, but I could not resolve all of them safely. Please repeat the reminder times with AM/PM or dates so I do not save the wrong reminder.",
      readyToSave: false,
    };
  }

  return {
    draft,
    assistantText: responseForDraft(draft),
    readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
  };
}

export function createRemindersFromDraft(draft: ReminderDraft): SaveResult {
  if (missingSlots(draft).length > 0 || hasPastAlert(draft.alerts)) {
    return {
      reminders: [],
      assistantText: responseForDraft(draft),
    };
  }

  const now = new Date().toISOString();
  const reminders: Reminder[] = draft.alerts.map((alert) => ({
    id: safeId(),
    title: draft.task,
    rawText: draft.rawText,
    dateText: alert.dateLabel,
    datePhrase: alert.datePhrase,
    timeText: alert.timeText,
    dueAt: alert.dueAt,
    status: "confirmed",
    category: draft.category,
    createdAt: now,
    notifiedAt: null,
    approximateTime: alert.approximate,
    eventAt: draft.eventAt,
    eventDateText: draft.eventAt ? dateLabel(new Date(draft.eventAt)) : undefined,
    eventTimeText: draft.eventTimeText || undefined,
    eventPhrase: draft.eventAt ? `${draft.eventDatePhrase} at ${draft.eventTimeText}` : undefined,
    sourceDraftId: draft.id,
  }));

  const first = reminders[0];
  const singleReminderIsEventTime =
    reminders.length === 1 &&
    Boolean(draft.eventAt) &&
    first.dueAt &&
    new Date(first.dueAt).getTime() === new Date(draft.eventAt as string).getTime();

  const savedText =
    reminders.length > 1
      ? `Done — I’ve saved ${reminders.length} reminders for ${draft.task}.`
      : singleReminderIsEventTime
        ? `Done — I’ll remind you about ${draft.task} ${first.datePhrase} at ${first.timeText}. This is the event time you gave me.`
        : `Done — I’ll remind you about ${draft.task} ${first.datePhrase} at ${first.timeText}.`;

  const eventText =
    draft.eventAt && draft.eventTimeText && !singleReminderIsEventTime
      ? ` The event is at ${draft.eventTimeText}.`
      : "";

  return {
    reminders,
    assistantText: `${savedText}${eventText}`,
  };
}

export function updateLearningMemory(memory: LearningMemory, reminders: Reminder[]) {
  const next: LearningMemory = JSON.parse(JSON.stringify(memory || DEFAULT_LEARNING_MEMORY));

  for (const reminder of reminders) {
    const words = reminder.title.toLowerCase().split(/\W+/).filter((word) => word.length >= 3);
    for (const word of words.slice(0, 6)) {
      const current = next.categoryPatterns[word] || { category: reminder.category, acceptedCount: 0 };
      next.categoryPatterns[word] = {
        category: reminder.category,
        acceptedCount: current.acceptedCount + 1,
      };
    }

    const date = reminder.dueAt ? new Date(reminder.dueAt) : null;
    if (date) {
      const hour = date.getHours();
      const period = hour >= 12 ? "pm" : "am";
      const key = `${reminder.title.toLowerCase().split(/\W+/)[0] || "reminder"}_${hour % 12 || 12}`;
      const current = next.ampmPatterns[key] || { period, acceptedCount: 0 };
      next.ampmPatterns[key] = {
        period,
        acceptedCount: current.acceptedCount + 1,
      };
    }
  }

  return next;
}

export function visibleReminders(reminders: Reminder[]) {
  const now = Date.now();
  return reminders
    .map((reminder) => {
      if (
        reminder.status === "confirmed" &&
        reminder.dueAt &&
        new Date(reminder.dueAt).getTime() < now &&
        reminder.notifiedAt
      ) {
        return { ...reminder, status: "archived" as const };
      }

      return reminder;
    })
    .filter((reminder) => reminder.status !== "archived");
}

export function getTestBank() {
  return [
    "Meet at 4 → pm → tomorrow",
    "Meeting at 6 pm → tomorrow however need a reminder at 4",
    "Meeting at 7 pm → today → 6pm n then 6.30",
    "Meet at 8 → pm → today at 10 and tomorrow 7",
    "Team meeting at 5 pm, remind me half an hour before → today",
    "Lunch with X tomorrow, reminder at 12 and 1 as lunch is at 1.10",
    "Dinner at 9 pm → Tuesday",
    "Doctor appointment next Tuesday morning",
    "Pay electricity bill Friday evening",
    "tomorro → tomorrow",
  ];
}