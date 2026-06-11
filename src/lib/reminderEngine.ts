import type {
  EngineResult,
  LearningMemory,
  Reminder,
  ReminderAlert,
  ReminderCategory,
  ReminderDraft,
  ReminderRepeatRule,
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
    repeatRule: null,
    isAlarm: false,
    pendingRepeatQuestion: null,
  };
}

function normaliseRepeatVoiceArtifacts(input: string) {
  let text = input;

  // Google voice frequently hears "every 1 hour" / "every one hour" as "everyone".
  // Keep this correction scoped to repeat/alarm contexts so normal wording is not changed.
  if (/\b(repeat|repeating|repetitive|recurring|alarm)\b/i.test(text)) {
    text = text
      .replace(/\b(?:repeats?|receipts?|receives?)\s+after\s+every\s+one\b/gi, "repeats every 1 hour")
      .replace(/\b(?:repeats?|receipts?|receives?)\s+after\s+everyone\b/gi, "repeats every 1 hour")
      .replace(/\b(?:repeats?|receipts?|receives?)\s+every\s+one\b/gi, "repeats every 1 hour")
      .replace(/\b(?:repeats?|receipts?|receives?)\s+everyone\b/gi, "repeats every 1 hour")
      .replace(/\bevery\s+one\b/gi, "every 1 hour")
      .replace(/\beveryone\b/gi, "every 1 hour");
  }

  return text;
}

export function normaliseInput(input: string) {
  return normaliseRepeatVoiceArtifacts(normaliseWithMiniViktor(input));
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

function wordOrNumberToInt(value: string | undefined) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return WORD_NUMBERS[lower] || null;
}

function parseRelativeFromNow(input: string, now: Date) {
  const lower = normaliseInput(input).toLowerCase();

  // Guardrail: “15/30/45 minutes before” belongs to before-event offset logic,
  // not relative-from-now scheduling. Without this, MiniViktor treats
  // “5 pm, remind me 30 minutes before” as “30 minutes from now”
  // and loses the actual event time.
  if (/\b(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:seconds?|secs?|sec|minutes?|mins?|min|hours?|hrs?|hr)\s+before\b/i.test(lower)) {
    return null;
  }

  const match =
    lower.match(/\b(?:in|after|for)?\s*(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(seconds?|secs?|sec)\s*(?:from now|later)?\b/) ||
    lower.match(/\b(?:in|after|for)?\s*(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(minutes?|mins?|min)\s*(?:from now|later)?\b/) ||
    lower.match(/\b(?:in|after|for)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(hours?|hrs?|hr)\s*(?:from now|later)?\b/);
  if (!match) return null;
  const amount = wordOrNumberToInt(match[1]);
  if (!amount || amount <= 0) return null;
  const unit = match[2].toLowerCase();
  const seconds = unit.startsWith("h") ? amount * 3600 : unit.startsWith("m") ? amount * 60 : amount;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const due = new Date(now.getTime() + seconds * 1000);
  return { due, minutes, seconds };
}


function parseRepeatStartRelative(input: string, now: Date) {
  const lower = normaliseInput(input).toLowerCase();

  // In repeat commands, "after 1 hour" can describe the repeat interval,
  // while "alarm is for 1 minute from now" describes the first ring.
  // Prefer the explicit start/first-ring phrase so we do not schedule the
  // first alarm for the repeat interval by mistake.
  const explicitStart =
    lower.match(/\b(?:first\s+)?(?:alarm|start|starting|starts|start time|first due)\s*(?:is\s+for|is|should\s+be|at|for|from)?\s*(?:within\s*)?(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(seconds?|secs?|sec|minutes?|mins?|min|hours?|hrs?|hr)\s*(?:from now|later)?\b/i) ||
    lower.match(/\b(?:in|after|within)\s*(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(seconds?|secs?|sec|minutes?|mins?|min|hours?|hrs?|hr)\s*(?:from now|later)?\b/i);

  if (!explicitStart) return null;
  const amount = wordOrNumberToInt(explicitStart[1]);
  if (!amount || amount <= 0) return null;
  const unit = explicitStart[2].toLowerCase();
  const seconds = unit.startsWith("h") ? amount * 3600 : unit.startsWith("m") ? amount * 60 : amount;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return { due: new Date(now.getTime() + seconds * 1000), minutes, seconds };
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

    // Native speech sometimes produces invalid mixed forms such as
    // "21:15 pm". Treat 24-hour values as explicit 24-hour time and
    // ignore the redundant AM/PM suffix instead of falling back to an old draft.
    if (hour >= 13 && hour <= 23 && minute >= 0 && minute <= 59) {
      return {
        raw: numeric[0],
        hour,
        minute,
        period: hour >= 12 ? "pm" : "am",
        hasPeriod: true,
        approximate,
      };
    }

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
  return /\b(dinner|lunch|party|night|evening)\b/i.test(text);
}

function hasMorningContext(text: string) {
  return /\b(breakfast|morning|school)\b/i.test(text);
}

function canUseSoftMealTimeInference(token: TimeToken) {
  // “lunch at 1:10” is reasonably resolvable to PM, but “lunch at 2”
  // is intentionally ambiguous and should ask AM/PM.
  return token.minute > 0 || /\b(noon|midnight|morning|afternoon|evening|night)\b/i.test(token.raw);
}

function hasWakeUpIntent(text: string) {
  return /\bwake\s+me\s+up\b/i.test(normaliseInput(text));
}

function voiceShortcutTimeToken(text: string): TimeToken | null {
  const lower = normaliseInput(text).toLowerCase();
  if (/\batm\b/.test(lower)) {
    return { raw: "ATM", hour: 8, minute: 0, period: "pm", hasPeriod: true };
  }
  if (/\bmeter\b/.test(lower)) {
    return { raw: "meter", hour: 6, minute: 0, period: null, hasPeriod: false };
  }
  return null;
}

function isAlarmCommand(text: string) {
  return /\b(alarm|wake\s+me\s+up)\b/i.test(normaliseInput(text));
}

function extractAlarmTaskFromInput(input: string) {
  const text = normaliseInput(input).trim();
  if (hasWakeUpIntent(text)) return "Wake up";

  const explicitTitle = extractExplicitTitleFromInput(text);
  if (explicitTitle) return explicitTitle;

  const dailyFor = text.match(/\b(?:set|create|start|make)?\s*(?:a\s+)?(?:daily|weekly|repeating|repetitive|recurring)?\s*alarm\s+for\s+(.+?)\s+at\s+\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\b/i);
  if (dailyFor) {
    const task = stripNoiseFromTask(dailyFor[1]);
    if (task) return task;
  }

  return null;
}

function extractEveryReminderTask(input: string) {
  const text = normaliseInput(input).trim();
  const forMatch = text.match(/\bevery\s+.+?\s+remind\s+me\s+(?:for|to|about)\s+(.+)$/i);
  if (forMatch) {
    const task = stripNoiseFromTask(forMatch[1]);
    if (task) return task;
  }

  const toMatch = text.match(/\bremind\s+me\s+every\s+.+?\s+to\s+(.+)$/i);
  if (toMatch) {
    const task = stripNoiseFromTask(toMatch[1]);
    if (task) return task;
  }

  return null;
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

  if (context.phrase && hasDinnerContext(context.phrase) && canUseSoftMealTimeInference(token)) {
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

  const minutes = lower.match(/\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(minutes|minute|mins|min)\s+before\b/);
  if (minutes) return wordOrNumberToInt(minutes[1]) || null;

  const hours = lower.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(hours|hour|hrs|hr)\s+before\b/);
  if (hours) return (wordOrNumberToInt(hours[1]) || 0) * 60;

  return null;
}


function isRepeatIntent(text: string) {
  return /\b(repeat|repeats|repeating|repetitive|repetition|repeaters?|repeater|recurring|daily|weekly|every\s+\d+\s*(hour|hours|hr|hrs|minute|minutes|min|mins)|every\s+(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)|interval)\b/i.test(text);
}

function repeatLabel(rule: ReminderRepeatRule | null | undefined) {
  return rule?.label || "Does not repeat";
}

function hasTodayOnlyRepeatStop(text: string) {
  return /\b(today\s+only|only\s+today|for\s+today\s+only|just\s+today|this\s+day\s+only|current\s+day\s+only)\b/i.test(text);
}

function isBareTodayOnlyAnswer(text: string) {
  return /^(today|today only|only today|for today|for today only|just today)$/i.test(text.trim());
}

function withTodayOnlyRepeatStop(rule: ReminderRepeatRule, now: Date): ReminderRepeatRule {
  const todayISO = dateOnlyISO(now);
  const suffix = /today only/i.test(rule.label) ? "" : " · today only";
  return {
    ...rule,
    endDateISO: todayISO,
    endDatePhrase: "today",
    label: `${rule.label}${suffix}`,
  };
}

function weekdayNumberFromText(text: string): number | null {
  const lower = text.toLowerCase();
  const map: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };
  for (const [key, value] of Object.entries(map)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(lower)) return value;
  }
  return null;
}

function weekdayName(day: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day] || "the selected day";
}

function parseRepeatRule(input: string): { rule: ReminderRepeatRule | null; needsStart?: boolean; needsKind?: boolean; defaultAlarm?: boolean } {
  const lower = normaliseInput(input).toLowerCase();
  if (!isRepeatIntent(lower)) return { rule: null };

  const interval = lower.match(/\b(?:every|interval(?: of)?|with|(?:at\s+)?gap\s+of)\s+(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/);
  const repeatAfterInterval = lower.match(/\b(?:repeat(?:ing|itive)?|repetition|repeaters?|repeater|ring)\s*(?:alarm|reminder)?\s*(?:should\s+be|is|will\s+be)?\s*(?:after|every)\s+(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/);
  // Guardrail: “starting in 1 minute” / “start in 1 min” is the first ring time,
  // not the repeat gap. MiniViktor must ask for the gap instead of assuming every 1 minute.
  const intervalMatch = interval || repeatAfterInterval;
  if (intervalMatch) {
    const amount = wordOrNumberToInt(intervalMatch[1]);
    if (amount) {
      const unit = intervalMatch[2].toLowerCase();
      const minutes = unit.startsWith("h") ? amount * 60 : amount;
      const rule: ReminderRepeatRule = {
        kind: "hourly",
        intervalMinutes: minutes,
        label: minutes === 60 ? "Repeats every 1 hour" : minutes % 60 === 0 ? `Repeats every ${minutes / 60} hours` : `Repeats every ${minutes} minutes`,
      };
      return {
        rule: hasTodayOnlyRepeatStop(lower) ? withTodayOnlyRepeatStop(rule, new Date()) : rule,
        needsStart: !parseRepeatStartRelative(lower, new Date()) && !parseRelativeFromNow(lower, new Date()),
        defaultAlarm: true,
      };
    }
  }


  if (/\bdaily or weekly\b|\bweekly or daily\b/.test(lower)) {
    return { rule: null, needsKind: true, defaultAlarm: true };
  }

  if (/\bdaily\b|\bevery day\b/.test(lower)) {
    const rule: ReminderRepeatRule = { kind: "daily", intervalMinutes: 24 * 60, label: "Repeats daily" };
    return {
      rule: hasTodayOnlyRepeatStop(lower) ? withTodayOnlyRepeatStop(rule, new Date()) : rule,
      defaultAlarm: true,
    };
  }

  if (/\bweekly\b|\bevery week\b|\bevery\s+(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)\b/.test(lower)) {
    const weekday = weekdayNumberFromText(lower);
    const everyReminderTask = extractEveryReminderTask(input);
    const rule: ReminderRepeatRule = {
      kind: "weekly",
      intervalMinutes: 7 * 24 * 60,
      daysOfWeek: weekday === null ? [] : [weekday],
      label: weekday === null ? "Repeats weekly" : `Repeats weekly on ${weekdayName(weekday)}`,
    };
    return {
      rule: hasTodayOnlyRepeatStop(lower) ? withTodayOnlyRepeatStop(rule, new Date()) : rule,
      defaultAlarm: everyReminderTask ? false : true,
    };
  }


  return { rule: null, needsKind: true, defaultAlarm: true };
}

function nextDailyAt(token: TimeToken, now: Date) {
  const resolved = to24Hour(token, { now, phrase: "daily alarm", alertDateISO: dateOnlyISO(now) });
  if (resolved.needsAMPM) return null;
  const due = startOfDay(now);
  due.setHours(resolved.hour, resolved.minute, 0, 0);
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  return due;
}

function nextWeeklyAt(token: TimeToken, weekday: number, now: Date) {
  const today = startOfDay(now);
  let add = weekday - today.getDay();
  if (add < 0) add += 7;
  const due = new Date(today.getTime() + add * MS_DAY);
  const resolved = to24Hour(token, { now, phrase: "weekly alarm", alertDateISO: dateOnlyISO(due) });
  if (resolved.needsAMPM) return null;
  due.setHours(resolved.hour, resolved.minute, 0, 0);
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 7);
  return due;
}

function applyRepeatDueFromInput(draft: ReminderDraft, input: string, now: Date) {
  if (!draft.repeatRule || draft.alerts.length > 0) return draft;
  const tokens = extractTimeTokens(input);
  const token = tokens[0];
  if (!token) return draft;

  let due: Date | null = null;
  if (draft.repeatRule.kind === "daily") {
    due = nextDailyAt(token, now);
    if (due && draft.repeatRule) {
      draft.repeatRule = { ...draft.repeatRule, timeText: formatTime(due.getHours(), due.getMinutes()), label: `Repeats daily at ${formatTime(due.getHours(), due.getMinutes())}` };
    }
  }
  if (draft.repeatRule.kind === "weekly") {
    const weekday = draft.repeatRule.daysOfWeek?.[0] ?? weekdayNumberFromText(input) ?? now.getDay();
    due = nextWeeklyAt(token, weekday, now);
    if (due && draft.repeatRule) {
      draft.repeatRule = { ...draft.repeatRule, daysOfWeek: [weekday], timeText: formatTime(due.getHours(), due.getMinutes()), label: `Repeats weekly on ${weekdayName(weekday)} at ${formatTime(due.getHours(), due.getMinutes())}` };
    }
  }
  if (due) {
    draft.alerts = [createAlert(dateOnlyISO(due), due.getHours(), due.getMinutes())];
    draft.eventDateISO = dateOnlyISO(due);
    draft.eventDatePhrase = datePhrase(due);
  }
  return draft;
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


function extractTaskFromReminderCommand(input: string) {
  const text = input.trim();

  // Voice-friendly command handling:
  // “Remind me to test alarm at 6:42 pm” -> “test alarm”
  // “Remind me at 2 pm for cooking” -> “cooking”
  // “Set a reminder for 1:15 pm today” -> no task yet, ask what to remind about.
  const direct = text.match(/^(?:remind me|set(?: a)? reminder|create(?: a)? reminder)\s*(?:to|for|about)?\s*(.*)$/i);
  if (!direct) return null;

  const remainder = direct[1].trim();
  if (!remainder) return null;

  const afterTimeFor = remainder.match(/^(?:at\s*)?\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s+(?:for|to|about)\s+(.+)$/i);
  let task = afterTimeFor ? afterTimeFor[1] : remainder;

  task = stripNoiseFromTask(task) || "";
  task = task
    .replace(/^to\s+/i, "")
    .replace(/^for\s+/i, "")
    .replace(/^about\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // Reject fragments created by incomplete/misheard commands like
  // “set a reminder for 1 or”. MiniViktor should ask for the missing task,
  // not save “set a” as the reminder title.
  if (!task || /^(set|set a|a|or|for|to|about|something)$/i.test(task)) return null;
  return task;
}

function stripNoiseFromTask(input: string) {
  let task = input;

  task = task
    .replace(/\b(?:set|create|start|make)\s+(?:an?\s+)?alarm\b/gi, "")
    .replace(/\b(remind me|set(?: a)? reminder|create(?: a)? reminder|reminder|need(?: a)? reminder|notify me|alert me)\b.*$/i, "")
    .replace(/\bbut need\b.*$/i, "")
    .replace(/\bhowever need\b.*$/i, "")
    .replace(/\bas .*?\bis at\s+\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/i, "")
    .replace(/\b(today|tomorrow|day after tomorrow)\b/gi, "")
    .replace(/\b(this\s+|next\s+)?(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)\b/gi, "")
    .replace(/\bon\s+\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\bthe\s+\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\bat\s+\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/gi, "")
    .replace(/\b\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi, "")
    .replace(/\b(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:minutes?|mins?|min|hours?|hrs?|hr)\s+before\b/gi, "")
    .replace(/\bhalf an hour before\b|\bhalf hour before\b|\ban hour before\b|\bone hour before\b|\bquarter of an hour before\b/gi, "")
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+[.,;:]+/g, "")
    .replace(/\b(?:for|to|about|with|title|heading|subject|name|label|caption)\s*$/i, "")
    .replace(/[ ,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(reminder|remind me|set reminder|set a reminder|set a|something|or)$/i.test(task)) return "";
  return task;
}


function cleanExplicitTitleCandidate(value: string) {
  return (stripNoiseFromTask(value) || value)
    .replace(/^(?:as|to|is|of|called|named|titled|heading|headed|labelled|labeled|captioned)\s+/i, "")
    .replace(/\b(?:for|on)\s+(?:today|tomorrow|day after tomorrow)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExplicitTitleFromInput(input: string) {
  const text = normaliseInput(input).trim();

  // Sprint 3N.13.1: handle explicit title/heading synonyms in full reminder/alarm commands.
  // Examples:
  // - "set an alarm for 6 am with title flight to Bombay"
  // - "set an alarm for 6 am with heading flight to Bombay"
  // - "set an alarm at 6 called flight to Bombay"
  // - "remind me tomorrow 8 with subject passport renewal"
  const patterns = [
    /\b(?:with|using|under)\s+(?:the\s+)?(?:title|heading|headings|subject|name|label|caption|description|topic)\s*(?:as|is|of|to|:|-)?\s+(.+)$/i,
    /\b(?:whose\s+)?(?:title|heading|subject|name|label|caption|description|topic)\s*(?:is|as|to|:|-)\s+(.+)$/i,
    /\b(?:named|called|titled|headed|labelled|labeled|captioned)\s+(.+)$/i,
    /\b(?:save it as|call it|make it|name it|rename it|title it|heading it|label it|caption it)\s+(.+)$/i,
    /\b(?:name|rename|title|heading|label|caption)(?:\s+the)?(?:\s+(?:alarm|reminder))?\s+(?:as|to)\s+(.+)$/i,
    /\b(?:call)(?:\s+the)?(?:\s+(?:alarm|reminder))?\s+(?:as|to)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = cleanExplicitTitleCandidate(match[1]);
      if (candidate && !isTimeOnlyTaskCandidate(candidate)) return candidate;
    }
  }

  return null;
}

function titleFromAsCommand(input: string) {
  return extractExplicitTitleFromInput(input);
}

function extractReminderSegment(input: string): string | null {
  const match = input.match(/\b(?:remind me|set(?: a)? reminder|create(?: a)? reminder|reminder|need(?: a)? reminder|notify me|alert me)\b(.*)$/i);
  if (!match) return null;
  return match[1].trim();
}

function stripEventClauseFromReminderSegment(segment: string) {
  return segment
    .replace(/\bas .*?\bis at\s+\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function explicitEventTime(input: string, draft: ReminderDraft): TimeToken | null {
  const lower = input.toLowerCase();
  const asMatch = lower.match(/\bas .*?\bis at\s+(.+)$/i);
  if (asMatch) return parseOneTimeToken(asMatch[1]);

  const reminderSegment = extractReminderSegment(input);
  const beforeReminder = reminderSegment ? input.slice(0, input.toLowerCase().indexOf(reminderSegment.toLowerCase())) : input;

  const tokens = extractTimeTokens(beforeReminder);
  if (tokens.length > 0) return tokens[0];

  const shortcutToken = voiceShortcutTimeToken(beforeReminder);
  if (shortcutToken) return shortcutToken;

  // Corpus-hardening: direct one-shot commands such as
  // “Remind me to call Raj tomorrow at 8 pm” contain the event/reminder time
  // inside the reminder command segment. Earlier logic skipped that segment,
  // leaving eventTimeText blank. Only use the full input when the command also
  // carries a real task; pure forms like “remind me at 4 pm” must still ask
  // what the reminder is about.
  const commandTask = extractTaskFromReminderCommand(input);
  if (!draft.eventTimeText && commandTask && !isTimeOnlyTaskCandidate(commandTask)) {
    const all = extractTimeTokens(input);
    return all[0] || voiceShortcutTimeToken(input) || null;
  }

  if (!draft.eventTimeText && !reminderSegment) {
    const all = extractTimeTokens(input);
    return all[0] || voiceShortcutTimeToken(input) || null;
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
  const previousEventAt = draft.eventAt;
  const eventAt = eventDateISO ? combineDateAndTime(eventDateISO, resolved.hour, resolved.minute).toISOString() : null;

  // If the only alert was the event-time default, changing the event time must
  // move that default alert too. Otherwise MiniViktor says "updated to 5:15"
  // while still carrying the old 5:14 event in the draft.
  let alerts = draft.alerts;
  const hadDefaultEventAlert = Boolean(
    previousEventAt &&
    draft.alerts.length === 1 &&
    Math.abs(new Date(draft.alerts[0].dueAt).getTime() - new Date(previousEventAt).getTime()) < 1000
  );
  if (hadDefaultEventAlert && eventDateISO && eventAt) {
    const changedEvent = new Date(eventAt);
    alerts = [createAlert(eventDateISO, changedEvent.getHours(), changedEvent.getMinutes())];
  }

  return {
    ...draft,
    eventTimeText: formatTime(resolved.hour, resolved.minute),
    eventAt,
    alerts,
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

function createRelativeAlertFromDue(due: Date, approximate = false): ReminderAlert {
  const dateISO = dateOnlyISO(due);
  return {
    id: safeId(),
    dateISO,
    dateLabel: dateLabel(due),
    datePhrase: datePhrase(due),
    timeText: `${approximate ? "around " : ""}${formatTime(due.getHours(), due.getMinutes())}`,
    dueAt: due.toISOString(),
    approximate,
  };
}

function isRelativeFromNowText(text: string) {
  return Boolean(parseRelativeFromNow(text, new Date()));
}

function refreshRelativeDraftDue(draft: ReminderDraft, now: Date): ReminderDraft {
  const relative = parseRepeatStartRelative(draft.rawText, now) || parseRelativeFromNow(draft.rawText, now);
  if (!relative || draft.alerts.length === 0) return draft;

  const alert = createRelativeAlertFromDue(relative.due, false);
  return {
    ...draft,
    alerts: [alert],
    eventDateISO: alert.dateISO,
    eventDatePhrase: alert.datePhrase,
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

function isGenericAlarmTask(task: string) {
  return /^alarm$/i.test(task.trim());
}

function isAlarmIntentOnly(input: string) {
  const lower = normaliseInput(input).toLowerCase().trim();
  return /^(create|set|start|make)\s+(an?\s+)?alarm$/.test(lower) || /^alarm$/.test(lower);
}

function isTimeOnlyTaskCandidate(task: string) {
  const lower = normaliseInput(task).toLowerCase().trim();
  if (!lower) return true;
  if (/^(today|tomorrow|day after tomorrow)$/.test(lower)) return true;
  if (/^(in|after|for)?\s*\d{1,3}\s*(seconds?|secs?|sec|minutes?|mins?|min|hours?|hrs?|hr)\s*(from now|later)?$/.test(lower)) return true;
  if (/^\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(am|pm|a\.m\.|p\.m\.)?$/.test(lower)) return true;
  if (/^(at\s+)?\d{1,2}(?:(?:\:|\.)\d{1,2})?\s*(am|pm|a\.m\.|p\.m\.)?\s*(today|tomorrow)?$/.test(lower)) return true;
  if (/^(set|create|start|make)\s+(an?\s+)?alarm\s*(for|at)?$/.test(lower)) return true;
  if (/^(set|create)\s+(a\s+)?reminder\s*(for|to|about)?$/.test(lower)) return true;
  return false;
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
  if (draft.pendingRepeatQuestion) missing.push("repeat details");
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

  if (draft.pendingRepeatQuestion === "repeat_kind") {
    return "Should this repeat daily or weekly, and what time should it ring?";
  }

  if (draft.pendingRepeatQuestion === "repeat_interval") {
    const startText = draft.alerts.length ? ` starting ${draft.alerts[0].datePhrase} at ${draft.alerts[0].timeText}` : "";
    const scopeText = hasTodayOnlyRepeatStop(draft.rawText) || draft.repeatRule?.endDatePhrase === "today" ? " for today only" : "";
    return `Got it${startText}${scopeText}. How often should it repeat? For example: every 30 minutes or every 1 hour.`;
  }

  if (draft.pendingRepeatQuestion === "repeat_start") {
    return `${draft.task || "Alarm"} will ${repeatLabel(draft.repeatRule).toLowerCase()}. When should the first alarm start?`;
  }

  if (draft.pendingRepeatQuestion === "repeat_time") {
    return `${draft.task || "Alarm"} will ${repeatLabel(draft.repeatRule).toLowerCase()}. What time should it ring?`;
  }

  if (!draft.task.trim()) {
    if (draft.alerts.length > 0) {
      const alertText = draft.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`).join(" and ");
      return `Sure — what should I remind you about ${alertText}?`;
    }
    const datePart = draft.eventDatePhrase ? ` ${draft.eventDatePhrase}` : "";
    const timePart = draft.eventTimeText ? ` at ${draft.eventTimeText}` : "";
    return `Sure — what should I remind you about${datePart}${timePart}?`;
  }

  if (missing.includes("the event day")) {
    const alertText = draft.alerts.length
      ? draft.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`).join(" and ")
      : "";
    if (draft.isAlarm) {
      return alertText
        ? `I have the alarm alert${draft.alerts.length > 1 ? "s" : ""} as ${alertText}. Which day should I set the alarm "${draft.task}" for at ${draft.eventTimeText}?`
        : `Which day should I set the alarm "${draft.task}" for at ${draft.eventTimeText}?`;
    }
    return alertText
      ? `I have the reminder alert${draft.alerts.length > 1 ? "s" : ""} as ${alertText}. Which day is ${draft.task} itself at ${draft.eventTimeText}?`
      : `Which day is ${draft.task} at ${draft.eventTimeText}?`;
  }
  if (isGenericAlarmTask(draft.task) && draft.alerts.length === 0 && !draft.eventTimeText) {
    return "Sure — when should I set the alarm for?";
  }
  if (missing.includes("the day")) return "Sure — which day should I set this for?";
  if (missing.includes("the reminder time")) return isGenericAlarmTask(draft.task) ? "What time should I set the alarm for?" : "Got it. What time works for this reminder?";

  if (hasPastAlert(draft.alerts)) {
    return "One of those reminder times has already passed. Please choose a future time for that reminder.";
  }

  const eventText = draft.eventAt
    ? `${draft.eventDatePhrase || datePhrase(new Date(draft.eventAt))} at ${draft.eventTimeText}`
    : "";

  if (draft.alerts.length > 1) {
    const alertText = draft.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`).join(" and ");
    const repeatText = draft.repeatRule ? ` ${repeatLabel(draft.repeatRule)}.` : "";
    return draft.eventAt
      ? `Got it — ${draft.task} is ${eventText}. You want reminders ${alertText}.${repeatText} Should I save these reminders, adjust them, or drop them?`
      : `Got it — you want reminders ${alertText} for ${draft.task}.${repeatText} Should I save these reminders, adjust them, or drop them?`;
  }

  const alert = draft.alerts[0];
  const eventAndReminderSame =
    Boolean(draft.eventAt) &&
    new Date(draft.eventAt as string).getTime() === new Date(alert.dueAt).getTime();

  if (draft.eventAt && eventAndReminderSame) {
    const repeatText = draft.repeatRule ? ` ${repeatLabel(draft.repeatRule)}.` : "";
    if (draft.isAlarm) {
      return `Alarm "${draft.task}" is set for ${eventText}.${repeatText} Should I save this alarm, adjust it, or drop it?`;
    }
    return `${draft.task} is ${eventText}. I’ll remind you at the event time unless you want an earlier reminder.${repeatText} Should I save this reminder, adjust it, or drop it?`;
  }

  if (draft.eventAt && draft.eventTimeText !== alert.timeText.replace("around ", "")) {
    const repeatText = draft.repeatRule ? ` ${repeatLabel(draft.repeatRule)}.` : "";
    return `Got it — I’ll remind you about ${draft.task} ${alert.datePhrase} at ${alert.timeText}. The event is at ${draft.eventTimeText}.${repeatText} Should I save this reminder, adjust it, or drop it?`;
  }

  const repeatText = draft.repeatRule ? ` ${repeatLabel(draft.repeatRule)}.` : "";
  if (draft.isAlarm) {
    return `Perfect — alarm "${draft.task}" is set for ${alert.datePhrase} at ${alert.timeText}.${repeatText} Should I save this alarm, adjust it, or drop it?`;
  }
  return `Perfect — ${draft.task}, ${alert.datePhrase}, reminder time ${alert.timeText}.${repeatText} Should I save this reminder, adjust it, or drop it?`;
}

function cleanTextForTaskInput(input: string) {
  if (isAlarmIntentOnly(input)) return "Alarm";

  const directTitle = titleFromAsCommand(input);
  if (directTitle) return directTitle;

  const reminderCommandTask = extractTaskFromReminderCommand(input);
  if (reminderCommandTask && !isTimeOnlyTaskCandidate(reminderCommandTask)) return reminderCommandTask;

  const stripped = stripNoiseFromTask(input);
  return isTimeOnlyTaskCandidate(stripped) ? "" : stripped;
}

function isQuestionAboutMissing(text: string) {
  return /\b(what detail|what do you need|which detail|what else)\b/i.test(text);
}

export function isSaveIntent(text: string) {
  return /^(yes|save|save it|save reminder|looks good|go ahead|ok|okay|done|perfect)$/i.test(text.trim());
}

export function isCancelIntent(text: string) {
  return /^(no|cancel|cancel it|cancel that|cancel this|cancel current|cancel draft|cancel the draft|cancel this reminder|drop|drop it|drop this|drop that|drop this reminder|ignore|ignore it|ignore this|ignore that|ignore previous|ignore the previous|ignore previous one|ignore the previous one|ignore last|ignore the last|ignore last one|not needed|doesn't work|doesnt work|doesn’t work|start over|restart|new reminder|reset|clear|clear it|clear this|clear that|clear draft|clear the draft|clear reminder|clear this reminder|forget it|forget this|forget that|forget previous|forget the previous|forget last|discard|discard it|discard this|discard that|discard previous|discard the previous|scrap|scrap it|scrap this|scrap that|scrap this one|scratch it|scratch this|scratch that|delete it|delete this|delete that|delete draft|delete the draft|delete this reminder|remove it|remove this|remove that|remove draft|remove this reminder|erase it|erase this|erase draft|wipe it|wipe this|abandon it|abandon this|abort|abort it|ditch it|ditch this|kill it|kill this|void it|void this|bin it|bin this|trash it|trash this|stop it|stop this|skip it|skip this|not now|not this|not this one|leave it|leave this|leave that|never mind|nevermind)$/i.test(text.trim());
}

export function isChangeIntent(text: string) {
  return /^(change|change it|change something|edit|edit it|adjust|adjust it|adjusted|tweak|modify|modify it)$/i.test(text.trim());
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


function isFreshReminderCommand(text: string) {
  return /\b(remind me|set(?: a)? reminder|create(?: a)? reminder|reminder|notify me|alert me|set\s+(?:an?\s+)?alarm|create\s+(?:an?\s+)?alarm|start\s+(?:an?\s+)?alarm|make\s+(?:an?\s+)?alarm|wake\s+me\s+up)\b/i.test(text);
}

function isFreshFullReminderOrAlarmCommand(text: string) {
  const normalized = normaliseInput(text).trim();
  if (!isFreshReminderCommand(normalized)) return false;
  return Boolean(
    parseRelativeFromNow(normalized, new Date()) ||
      extractTimeTokens(normalized).length > 0 ||
      parseDate(normalized) ||
      extractExplicitTitleFromInput(normalized)
  );
}

function isSimpleReminderAlertCommand(text: string) {
  const normalized = normaliseInput(text).trim();
  if (isAlarmCommand(normalized)) return false;
  if (!/\b(remind me|set(?: a)? reminder|create(?: a)? reminder|notify me|alert me)\b/i.test(normalized)) return false;
  if (/\bas\b.*\bis at\b/i.test(normalized)) return false;
  return extractTimeTokens(normalized).length > 0 || Boolean(parseRelativeFromNow(normalized, new Date()));
}

function isResetOrIgnoreIntent(text: string) {
  return /^(start over|restart|new reminder|reset|clear|clear it|clear this|clear that|clear draft|clear the draft|clear reminder|clear this reminder|cancel|cancel it|cancel that|cancel this|cancel current|cancel draft|cancel the draft|cancel this reminder|drop|drop it|drop this|drop that|drop this reminder|ignore|ignore it|ignore this|ignore that|ignore previous|ignore the previous|ignore previous one|ignore the previous one|ignore last|ignore the last|ignore last one|forget it|forget this|forget that|forget previous|forget the previous|forget last|discard|discard it|discard this|discard that|discard previous|discard the previous|scrap|scrap it|scrap this|scrap that|scrap this one|scratch it|scratch this|scratch that|delete it|delete this|delete that|delete draft|delete the draft|delete this reminder|remove it|remove this|remove that|remove draft|remove this reminder|erase it|erase this|erase draft|wipe it|wipe this|abandon it|abandon this|abort|abort it|ditch it|ditch this|kill it|kill this|void it|void this|bin it|bin this|trash it|trash this|stop it|stop this|skip it|skip this|not now|not this|not this one|leave it|leave this|leave that|never mind|nevermind)$/i.test(text.trim());
}

export function processUserText(
  currentDraft: ReminderDraft | null,
  userInput: string,
  learning?: LearningMemory,
  options?: { now?: Date }
): EngineResult {
  let input = normaliseInput(userInput);
  const now = options?.now || new Date();

  if (isResetOrIgnoreIntent(input)) {
    return {
      draft: null,
      assistantText: "Understood — I’ll ignore the previous reminder. Tell me the next reminder when ready.",
      readyToSave: false,
    };
  }

  const correctionMatch = input.match(/^(?:no,?\s*)?(?:i said|actually|correction|correct that to|change that to)\s+(.+)$/i);
  const shouldResetDraftFromCorrection = Boolean(correctionMatch);
  if (correctionMatch) {
    input = normaliseInput(correctionMatch[1]);
  }

  const shouldResetStalePastDraft = Boolean(
    currentDraft &&
      hasPastAlert(currentDraft.alerts) &&
      isFreshReminderCommand(input)
  );

  // Sprint 3N.13.4: if the user gives a full new reminder/alarm phrase while an
  // earlier draft is incomplete or wrong, replace the draft instead of merging
  // old task/time with the new phrase. This fixes flows like:
  // "set a reminder for me to take part at" -> "set a reminder for me to take bath at 4 pm today".
  const shouldResetDraftFromFreshFullCommand = Boolean(
    currentDraft &&
      isFreshFullReminderOrAlarmCommand(input) &&
      (missingSlots(currentDraft).length > 0 || !currentDraft.lastQuestion || hasPastAlert(currentDraft.alerts))
  );

  let draft = !shouldResetDraftFromCorrection && !shouldResetStalePastDraft && !shouldResetDraftFromFreshFullCommand && currentDraft
    ? { ...currentDraft, alerts: [...currentDraft.alerts] }
    : createEmptyDraft();
  const contextDraft = shouldResetDraftFromCorrection || shouldResetStalePastDraft || shouldResetDraftFromFreshFullCommand ? null : currentDraft;
  const miniViktorIntent = classifyMiniViktorIntent(input, {
    hasDraft: Boolean(contextDraft),
    hasTask: Boolean(contextDraft?.task?.trim()),
    hasEventDate: Boolean(contextDraft?.eventDateISO),
    hasEventTime: Boolean(contextDraft?.eventTimeText),
    hasAlerts: Boolean(contextDraft?.alerts?.length),
    awaitingAMPM: Boolean(contextDraft?.pendingAmbiguousTime),
  });

  draft.rawText = [draft.rawText, input].filter(Boolean).join(" | ");

  if (currentDraft && hasPastAlert(currentDraft.alerts) && isRelativeFromNowText(input)) {
    const refreshed = refreshRelativeDraftDue(draft, now);
    refreshed.pendingRepeatQuestion = null;
    return {
      draft: refreshed,
      assistantText: responseForDraft(refreshed),
      readyToSave: missingSlots(refreshed).length === 0 && !hasPastAlert(refreshed.alerts),
    };
  }

  const repeatParse = parseRepeatRule(input);
  if (repeatParse.defaultAlarm) {
    draft.isAlarm = true;
    const alarmTask = extractAlarmTaskFromInput(input);
    const everyTask = extractEveryReminderTask(input);
    if (alarmTask) {
      draft.task = alarmTask;
    } else if (everyTask) {
      draft.task = everyTask;
      draft.isAlarm = false;
    } else if (!draft.task.trim() || isGenericAlarmTask(draft.task)) {
      draft.task = "Alarm";
      draft.category = "General";
    }
  }

  if (isAlarmIntentOnly(input) && !draft.task.trim() && draft.alerts.length === 0 && !draft.eventTimeText) {
    draft.task = "Alarm";
    draft.isAlarm = true;
    draft.category = "General";
    return {
      draft,
      assistantText: "Sure — when should I set the alarm for?",
      readyToSave: false,
    };
  }

  if (repeatParse.needsKind) {
    draft.task = draft.task.trim() || "Alarm";
    draft.isAlarm = true;
    const startOnly = parseRepeatStartRelative(input, now) || parseRelativeFromNow(input, now);
    if (startOnly) {
      const alert = createRelativeAlertFromDue(startOnly.due, false);
      draft.alerts = [alert];
      draft.eventDateISO = alert.dateISO;
      draft.eventDatePhrase = alert.datePhrase;
      draft.repeatRule = hasTodayOnlyRepeatStop(input)
        ? withTodayOnlyRepeatStop({ kind: "hourly", intervalMinutes: undefined, label: "Repeats" }, now)
        : null;
      draft.pendingRepeatQuestion = "repeat_interval";
    } else {
      draft.pendingRepeatQuestion = "repeat_kind";
    }
    return {
      draft,
      assistantText: responseForDraft(draft),
      readyToSave: false,
    };
  }

  if (repeatParse.rule) {
    draft.repeatRule = hasTodayOnlyRepeatStop(input) ? withTodayOnlyRepeatStop(repeatParse.rule, now) : repeatParse.rule;
    const alarmTask = extractAlarmTaskFromInput(input);
    const everyTask = extractEveryReminderTask(input);
    if (alarmTask) {
      draft.task = alarmTask;
      draft.isAlarm = true;
    } else if (everyTask) {
      draft.task = everyTask;
      draft.isAlarm = false;
    } else {
      draft.task = draft.task.trim() || "Alarm";
      draft.isAlarm = true;
    }

    const relativeForRepeat = parseRepeatStartRelative(input, now) || parseRelativeFromNow(input, now);
    if (relativeForRepeat && repeatParse.rule.kind === "hourly" && !repeatParse.needsStart) {
      const due = relativeForRepeat.due;
      const alert = createRelativeAlertFromDue(due, false);
      draft.alerts = [alert];
      draft.eventDateISO = alert.dateISO;
      draft.eventDatePhrase = alert.datePhrase;
    } else {
      draft = applyRepeatDueFromInput(draft, input, now);
    }

    if (draft.alerts.length === 0) {
      draft.pendingRepeatQuestion = repeatParse.needsStart ? "repeat_start" : "repeat_time";
    } else {
      draft.pendingRepeatQuestion = null;
    }

    return {
      draft,
      assistantText: responseForDraft(draft),
      readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
    };
  }

  if (draft.pendingRepeatQuestion === "repeat_interval") {
    const followRepeat = parseRepeatRule(input);
    if (followRepeat.rule) {
      draft.repeatRule = hasTodayOnlyRepeatStop(input) || hasTodayOnlyRepeatStop(draft.rawText)
        ? withTodayOnlyRepeatStop(followRepeat.rule, now)
        : followRepeat.rule;
      draft.pendingRepeatQuestion = null;
      return {
        draft,
        assistantText: responseForDraft(draft),
        readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
      };
    }

    if (hasTodayOnlyRepeatStop(input) || isBareTodayOnlyAnswer(input)) {
      draft.repeatRule = withTodayOnlyRepeatStop(draft.repeatRule || { kind: "hourly", intervalMinutes: undefined, label: "Repeats" }, now);
    }

    return {
      draft,
      assistantText: responseForDraft(draft),
      readyToSave: false,
    };
  }

  if (draft.pendingRepeatQuestion === "repeat_kind") {
    // Sprint 3M.4: "today only" is a repeat end-scope, not the repeat gap.
    // If we already know the first ring time, ask for the gap instead of assuming hourly.
    if (hasTodayOnlyRepeatStop(input) || isBareTodayOnlyAnswer(input)) {
      const relativeStart = parseRepeatStartRelative(draft.rawText, now) || parseRelativeFromNow(draft.rawText, now);
      if (relativeStart) {
        const alert = createRelativeAlertFromDue(relativeStart.due, false);
        draft.alerts = [alert];
        draft.eventDateISO = alert.dateISO;
        draft.eventDatePhrase = alert.datePhrase;
        draft.repeatRule = withTodayOnlyRepeatStop(draft.repeatRule || { kind: "hourly", intervalMinutes: undefined, label: "Repeats" }, now);
        draft.pendingRepeatQuestion = "repeat_interval";
        return {
          draft,
          assistantText: responseForDraft(draft),
          readyToSave: false,
        };
      }
    }
    const followRepeat = parseRepeatRule(input);
    if (followRepeat.rule) {
      draft.repeatRule = hasTodayOnlyRepeatStop(input) || hasTodayOnlyRepeatStop(draft.rawText) ? withTodayOnlyRepeatStop(followRepeat.rule, now) : followRepeat.rule;
      draft.isAlarm = true;
      draft.task = draft.task.trim() || "Alarm";
      const repeatStart = parseRepeatStartRelative(draft.rawText, now) || parseRepeatStartRelative(input, now);
      if (repeatStart) {
        const alert = createRelativeAlertFromDue(repeatStart.due, false);
        draft.alerts = [alert];
        draft.eventDateISO = alert.dateISO;
        draft.eventDatePhrase = alert.datePhrase;
      } else {
        draft = applyRepeatDueFromInput(draft, input, now);
      }
      draft.pendingRepeatQuestion = draft.alerts.length === 0 ? "repeat_time" : null;
      return {
        draft,
        assistantText: responseForDraft(draft),
        readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
      };
    }
  }

  if (draft.pendingRepeatQuestion === "repeat_start" || draft.pendingRepeatQuestion === "repeat_time") {
    const relativeStart = parseRelativeFromNow(input, now);
    if (relativeStart) {
      const due = relativeStart.due;
      const alert = createRelativeAlertFromDue(due, false);
      draft.alerts = [alert];
      draft.eventDateISO = alert.dateISO;
      draft.eventDatePhrase = alert.datePhrase;
      draft.pendingRepeatQuestion = null;
      return {
        draft,
        assistantText: responseForDraft(draft),
        readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
      };
    }
    draft = applyRepeatDueFromInput(draft, input, now);
    if (draft.alerts.length > 0) draft.pendingRepeatQuestion = null;
    return {
      draft,
      assistantText: responseForDraft(draft),
      readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
    };
  }

  const relativeReminder = parseRelativeFromNow(input, now);
  if (relativeReminder) {
    const due = relativeReminder.due;
    const alert = createRelativeAlertFromDue(due, false);
    draft.alerts = [alert];
    draft.eventDateISO = alert.dateISO;
    draft.eventDatePhrase = alert.datePhrase;
    if (isAlarmCommand(input)) {
      draft.isAlarm = true;
      const alarmTask = extractAlarmTaskFromInput(input);
      draft.task = alarmTask && !isTimeOnlyTaskCandidate(alarmTask) ? alarmTask : draft.task.trim() || "Alarm";
      draft.eventTimeText = (relativeReminder as { seconds?: number }).seconds && (relativeReminder as { seconds?: number }).seconds! < 60
        ? `${(relativeReminder as { seconds: number }).seconds} seconds from now`
        : `${relativeReminder.minutes} ${relativeReminder.minutes === 1 ? "minute" : "minutes"} from now`;
    }
    if (!draft.task.trim()) {
      const maybeTask = cleanTextForTaskInput(input);
      if (maybeTask && !/^(create|set|reminder|a)$/i.test(maybeTask) && !isTimeOnlyTaskCandidate(maybeTask)) {
        draft.task = maybeTask;
      }
    }
    return {
      draft,
      assistantText: responseForDraft(draft),
      readyToSave: missingSlots(draft).length === 0 && !hasPastAlert(draft.alerts),
    };
  }

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

  if (draft.pendingInferenceConfirmation && /^(no|incorrect|wrong|not correct|change|change it|adjust|adjust it)$/i.test(input.trim())) {
    draft = {
      ...draft,
      alerts: [],
      pendingInferenceConfirmation: null,
    };
    return {
      draft,
      assistantText: "Understood — please say the reminder times again with AM or PM so I do not save the wrong reminder.",
      readyToSave: false,
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
  if (isAlarmCommand(input)) {
    draft.isAlarm = true;
  }
  if (directTitle) {
    draft.task = directTitle;
  } else if (hasWakeUpIntent(input)) {
    draft.task = "Wake up";
    draft.isAlarm = true;
  }

  const parsedDate = parseDate(input);

  const reminderSegment = extractReminderSegment(input);
  const beforeOffset = offsetMinutes(input) || offsetMinutes(draft.rawText);
  const messageIsAlertInstruction =
    miniViktorIntent.primaryIntent === "multiple_dated_reminder_alerts" ||
    miniViktorIntent.primaryIntent === "multiple_reminder_alerts" ||
    miniViktorIntent.primaryIntent === "before_event_reminder" ||
    Boolean(currentDraft?.eventTimeText && (/\band\b|\bthen\b|,|&|\breminder\b|\bneed\b/i.test(input)));

  if (!directTitle && !hasWakeUpIntent(input)) {
    const everyReminderTask = extractEveryReminderTask(input);
    const taskCandidate = everyReminderTask || cleanTextForTaskInput(input);
    // MiniViktor must not throw away a clear task just because the same
    // sentence also contains reminder instructions. This is required for
    // phrases like “Team meeting at 5 pm, remind me half an hour before” and
    // “Every Monday at 8 am remind me for team standup”.
    if (taskCandidate && (!contextDraft || !draft.task.trim() || /^every$/i.test(draft.task.trim()))) {
      draft.task = taskCandidate;
    }
  }

  // Sprint 3N.13.4: bare alarm commands with only a time should not produce
  // titles such as "set an alarm for". Default to Alarm until user names it.
  if (draft.isAlarm && (!draft.task.trim() || isTimeOnlyTaskCandidate(draft.task) || /^(set|create|start|make)\s+(an?\s+)?alarm/i.test(draft.task))) {
    draft.task = "Alarm";
    draft.category = "General";
  }

  const eventToken = isSimpleReminderAlertCommand(input) ? null : explicitEventTime(input, draft);
  const isPureReminderFollowUp = Boolean(contextDraft?.eventTimeText) && messageIsAlertInstruction;

  // Apply the event date even when the same sentence also contains reminder
  // instructions. Without this, single-turn corpus cases like
  // “Meeting at 8 pm tomorrow, remind me today at 7 and tomorrow at 6” lose the
  // event date, and before-event offsets cannot be calculated.
  if (parsedDate && (!isPureReminderFollowUp || (draft.eventTimeText && !draft.eventDateISO) || Boolean(eventToken))) {
    draft = applyDate(draft, parsedDate);
  }

  if (eventToken && !isPureReminderFollowUp) {
    draft = applyEventTime(draft, eventToken, input);
  }

  if (parsedDate && draft.eventTimeText && !draft.eventAt) {
    draft = updateEventAtIfPossible(draft);
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
    draft = applyBeforeOffset(draft, draft.rawText);
  } else {
    const segmentForAlertsRaw =
      reminderSegment ||
      (isPureReminderFollowUp || messageIsAlertInstruction ? input : null);
    const segmentForAlerts = segmentForAlertsRaw ? stripEventClauseFromReminderSegment(segmentForAlertsRaw) : null;

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

  const finalEveryReminderTask = extractEveryReminderTask(input);
  if (finalEveryReminderTask && /^every$/i.test(draft.task.trim())) {
    draft.task = finalEveryReminderTask;
    draft.isAlarm = false;
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
  let draftToSave = draft;
  const saveMoment = new Date();

  // Sprint 3K: relative phrases such as "1 minute from now" must be
  // anchored to the save/confirmation moment, not the original parse moment.
  // This avoids false "time already passed" failures when the tester waits
  // a few seconds before saying "save".
  if (isRelativeFromNowText(draftToSave.rawText)) {
    draftToSave = refreshRelativeDraftDue(draftToSave, saveMoment);
  }

  if (missingSlots(draftToSave).length > 0 || hasPastAlert(draftToSave.alerts)) {
    return {
      reminders: [],
      assistantText: responseForDraft(draftToSave),
    };
  }

  const now = saveMoment.toISOString();
  const reminders: Reminder[] = draftToSave.alerts.map((alert) => ({
    id: safeId(),
    title: draftToSave.task,
    rawText: draftToSave.rawText,
    dateText: alert.dateLabel,
    datePhrase: alert.datePhrase,
    timeText: alert.timeText,
    dueAt: alert.dueAt,
    status: "confirmed",
    category: draftToSave.category,
    createdAt: now,
    notifiedAt: null,
    approximateTime: alert.approximate,
    eventAt: draftToSave.eventAt,
    eventDateText: draftToSave.eventAt ? dateLabel(new Date(draftToSave.eventAt)) : undefined,
    eventTimeText: draftToSave.eventTimeText || undefined,
    eventPhrase: draftToSave.eventAt ? `${draftToSave.eventDatePhrase} at ${draftToSave.eventTimeText}` : undefined,
    sourceDraftId: draftToSave.id,
    repeatRule: draftToSave.repeatRule || null,
    isAlarm: draftToSave.isAlarm || isGenericAlarmTask(draftToSave.task),
  }));

  const first = reminders[0];
  const singleReminderIsEventTime =
    reminders.length === 1 &&
    Boolean(draftToSave.eventAt) &&
    first.dueAt &&
    new Date(first.dueAt).getTime() === new Date(draftToSave.eventAt as string).getTime();

  const savedText =
    draftToSave.isAlarm && reminders.length === 1
      ? `Done — I’ll ring the alarm for ${draftToSave.task} ${first.datePhrase} at ${first.timeText}${draftToSave.repeatRule ? ` (${repeatLabel(draftToSave.repeatRule)})` : ""}.`
      : reminders.length > 1
        ? `Done — I’ve saved ${reminders.length} reminders for ${draftToSave.task}${draftToSave.repeatRule ? ` (${repeatLabel(draftToSave.repeatRule)})` : ""}.`
        : singleReminderIsEventTime
          ? `Done — I’ll remind you about ${draftToSave.task} ${first.datePhrase} at ${first.timeText}${draftToSave.repeatRule ? ` (${repeatLabel(draftToSave.repeatRule)})` : ""}. This is the event time you gave me.`
          : `Done — I’ll remind you about ${draftToSave.task} ${first.datePhrase} at ${first.timeText}${draftToSave.repeatRule ? ` (${repeatLabel(draftToSave.repeatRule)})` : ""}.`;

  const eventText =
    draftToSave.eventAt && draftToSave.eventTimeText && !singleReminderIsEventTime
      ? ` The event is at ${draftToSave.eventTimeText}.`
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
      const hasActiveRepeat = Boolean(reminder.repeatRule && reminder.repeatRule.kind !== "none");
      if (
        !hasActiveRepeat &&
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
    "Set an alarm for 6:00 am with title flight to Bombay → today",
    "Set an alarm for 6:00 am with heading flight to Bombay → today",
    "Set an alarm at 6 am called flight to Bombay → today",
    "remind me to have water at 7 p.m.",
    "set an alarm for 6:52 p.m.",
    "set an alarm for 6:40 p.m. and the title is to drink water",
    "set a reminder for me to take part at → set a reminder for me to take bath at 4 p.m. today",
  ];
}
