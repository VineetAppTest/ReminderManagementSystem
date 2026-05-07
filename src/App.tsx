import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type ReminderStatus = "confirmed" | "needs_info" | "done" | "archived";
type MissingField = "reminder details" | "date" | "time" | "ampm";
type ReminderCategory =
  | "Work"
  | "Personal"
  | "Health"
  | "Finance"
  | "Family"
  | "Social"
  | "Travel"
  | "Home"
  | "General";

type ReminderFilter =
  | "all"
  | "today"
  | "upcoming"
  | "Work"
  | "Personal"
  | "Health"
  | "Finance"
  | "Family"
  | "Social"
  | "Travel"
  | "Home"
  | "done";

type TimeSlot = {
  hour: number;
  minute: number;
  text: string;
  approximate: boolean;
  source: "reminder" | "event" | "general";
};

type Reminder = {
  id: string;
  title: string;
  rawText: string;
  dateText: string;
  datePhrase: string;
  timeText: string;
  dueAt: string | null;
  status: ReminderStatus;
  category: ReminderCategory;
  createdAt: string;
  notifiedAt?: string | null;
  approximateTime?: boolean;
  eventTimeText?: string;
};

type DraftReminder = {
  title: string;
  rawText: string;
  dateISO: string | null;
  dateText: string;
  datePhrase: string;
  time: TimeSlot | null;
  reminderTimes: TimeSlot[];
  eventTime: TimeSlot | null;
  dueAt: string | null;
  missing: MissingField[];
  dateAssumed: boolean;
  ambiguousHour: number | null;
  ambiguousMinute: number;
  ambiguousApproximate: boolean;
  category: ReminderCategory;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type NotificationState = NotificationPermission | "unsupported";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const STORAGE_KEY = "remindiq_reminders_v1";
const OLD_STORAGE_KEYS = [
  "rms_reminders_v7",
  "rms_reminders_v6",
  "rms_reminders_v5",
  "rms_reminders_v4",
  "rms_reminders_v2",
  "rms_reminders_v1",
];

const FILTERS: { value: ReminderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "Work", label: "Work" },
  { value: "Personal", label: "Personal" },
  { value: "Health", label: "Health" },
  { value: "Finance", label: "Finance" },
  { value: "Family", label: "Family" },
  { value: "Social", label: "Social" },
  { value: "Travel", label: "Travel" },
  { value: "Home", label: "Home" },
  { value: "done", label: "Done" },
];

const NUMBER_WORDS: Record<string, number> = {
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

function createId() {
  return crypto.randomUUID();
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function dateFromISO(iso: string | null) {
  return iso ? new Date(iso) : null;
}

function dateOnlyISO(date: Date) {
  const copy = cloneDate(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function formatDateLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (sameDate(date, today)) return "Today";
  if (sameDate(date, tomorrow)) return "Tomorrow";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDatePhrase(date: Date, dateAssumed: boolean) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (sameDate(date, today)) return "today";
  if (sameDate(date, tomorrow)) return "tomorrow";

  if (dateAssumed) {
    return `the coming ${getOrdinal(date.getDate())}`;
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTimeParts(hour: number, minute: number, approximate = false) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  const label = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  return approximate ? `around ${label}` : label;
}

function makeTimeSlot(
  hour: number,
  minute: number,
  source: TimeSlot["source"],
  approximate = false
): TimeSlot {
  return {
    hour,
    minute,
    source,
    approximate,
    text: formatTimeParts(hour, minute, approximate),
  };
}

function dueAtFor(dateISO: string | null, time: TimeSlot | null) {
  if (!dateISO || !time) return null;

  const date = new Date(dateISO);
  date.setHours(time.hour, time.minute, 0, 0);
  return date.toISOString();
}

function pickTemplate(templates: string[], seed: number) {
  return templates[seed % templates.length];
}

function isTimeOnlyNumber(text: string) {
  return /^\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*$/i.test(
    text
  );
}

function wordOrNumberToNumber(value: string) {
  const lower = value.toLowerCase();
  if (NUMBER_WORDS[lower]) return NUMBER_WORDS[lower];
  return Number(value);
}

function hasPmContext(text: string) {
  const lower = text.toLowerCase();
  return /\b(dinner|lunch|party|date|movie|evening|night|tonight)\b/.test(lower);
}

function hasAmContext(text: string) {
  const lower = text.toLowerCase();
  return /\b(breakfast|morning|walk|school|wakeup|wake up)\b/.test(lower);
}

function normalizeHour(hour: number, period: string, contextText: string) {
  const cleanPeriod = period.replace(/\./g, "").toLowerCase();

  if (cleanPeriod === "pm" && hour < 12) return hour + 12;
  if (cleanPeriod === "am" && hour === 12) return 0;
  if (cleanPeriod === "am" || cleanPeriod === "pm") return hour;

  if (hasPmContext(contextText) && hour >= 1 && hour <= 11) return hour + 12;
  if (hasAmContext(contextText) && hour === 12) return 0;

  return hour;
}

function isAmbiguousBareTime(hour: number, period: string, contextText: string) {
  if (period) return false;
  if (hour < 1 || hour > 12) return false;
  return !hasPmContext(contextText) && !hasAmContext(contextText);
}

function extractDate(text: string) {
  const lower = text.toLowerCase();
  let dateValue: Date | null = null;
  let dateAssumed = false;

  if (lower.includes("day after tomorrow")) {
    dateValue = new Date();
    dateValue.setDate(dateValue.getDate() + 2);
  } else if (lower.includes("tomorrow")) {
    dateValue = new Date();
    dateValue.setDate(dateValue.getDate() + 1);
  } else if (lower.includes("today")) {
    dateValue = new Date();
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  const weekdayMatch = lower.match(
    /\b(this\s+|next\s+)?(sun|sunday|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday)\b/
  );

  if (!dateValue && weekdayMatch) {
    const requested = weekdays[weekdayMatch[2]];
    const today = new Date();
    const date = new Date();
    const currentDay = today.getDay();
    let diff = requested - currentDay;

    if (weekdayMatch[1]?.trim() === "next") {
      if (diff <= 0) diff += 7;
      else diff += 7;
    } else if (diff <= 0) {
      diff += 7;
    }

    date.setDate(today.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    dateValue = date;
  }

  const monthMatch = lower.match(
    /\b(\d{1,2})(st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/
  );

  if (!dateValue && monthMatch) {
    const monthMap: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };

    const day = Number(monthMatch[1]);
    const month = monthMap[monthMatch[3]];
    const date = new Date();
    date.setMonth(month, day);
    date.setHours(0, 0, 0, 0);

    if (date < new Date()) date.setFullYear(date.getFullYear() + 1);
    dateValue = date;
  }

  const slashDateMatch = lower.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);

  if (!dateValue && slashDateMatch) {
    const day = Number(slashDateMatch[1]);
    const month = Number(slashDateMatch[2]) - 1;
    const yearText = slashDateMatch[3];
    const year = yearText
      ? Number(yearText.length === 2 ? `20${yearText}` : yearText)
      : new Date().getFullYear();
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    if (!yearText && date < new Date()) date.setFullYear(date.getFullYear() + 1);
    dateValue = date;
  }

  const dayOnlyMatch =
    lower.match(/\b(?:on\s+|the\s+)?(\d{1,2})(st|nd|rd|th)\b/) ||
    lower.match(/\bon\s+(\d{1,2})\b/) ||
    lower.match(/\bfor\s+(\d{1,2})(st|nd|rd|th)?\b/);

  if (!dateValue && dayOnlyMatch) {
    const day = Number(dayOnlyMatch[1]);
    const date = new Date();
    date.setDate(day);
    date.setHours(0, 0, 0, 0);

    if (date < new Date()) date.setMonth(date.getMonth() + 1);
    dateValue = date;
    dateAssumed = true;
  }

  if (!dateValue) return null;

  dateValue.setHours(0, 0, 0, 0);
  return {
    dateISO: dateOnlyISO(dateValue),
    dateText: formatDateLabel(dateValue),
    datePhrase: formatDatePhrase(dateValue, dateAssumed),
    dateAssumed,
  };
}

function extractNamedTask(text: string) {
  const match = text.match(/\b(?:save it as|call it|make it|name it)\s+(?:a\s+|an\s+|the\s+)?(.+)$/i);
  if (!match) return "";

  return match[1]
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTimeCandidates(text: string, contextText: string, source: TimeSlot["source"]) {
  const candidates: TimeSlot[] = [];
  const ambiguous: { hour: number; minute: number; approximate: boolean }[] = [];
  const seen = new Set<string>();
  const lower = text.toLowerCase();

  function pushCandidate(hour: number, minute: number, period: string, approximate: boolean) {
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;

    if (isAmbiguousBareTime(hour, period, contextText)) {
      ambiguous.push({ hour, minute, approximate });
      return;
    }

    const normalizedHour = normalizeHour(hour, period, contextText);
    const key = `${normalizedHour}:${minute}:${approximate}:${source}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(makeTimeSlot(normalizedHour, minute, source, approximate));
  }

  const numericRegex = /\b(around|about|approx|approximately|near|roughly)?\s*(\d{1,2})(?:\s*-?\s*ish|ish)?(?:(?::|\.)(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/g;
  let match: RegExpExecArray | null;

  while ((match = numericRegex.exec(lower))) {
    const prefix = match[1] || "";
    const hour = Number(match[2]);
    const minute = match[3] ? Number(match[3]) : 0;
    const period = match[4] || "";
    const raw = match[0];
    const approximate = Boolean(prefix) || /ish/.test(raw);

    if (hour >= 1 && hour <= 12) {
      pushCandidate(hour, minute, period, approximate);
    } else if (hour >= 13 && hour <= 23) {
      pushCandidate(hour, minute, period || "24h", approximate);
    }
  }

  const wordRegex = /\b(around|about|approx|approximately|near|roughly)?\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*-?\s*ish|ish)?\s*(am|pm|a\.m\.|p\.m\.)?\b/g;

  while ((match = wordRegex.exec(lower))) {
    const prefix = match[1] || "";
    const hour = wordOrNumberToNumber(match[2]);
    const period = match[3] || "";
    const raw = match[0];
    const approximate = Boolean(prefix) || /ish/.test(raw);
    pushCandidate(hour, 0, period, approximate);
  }

  return { candidates, ambiguous };
}

function extractEventAndReminderTimes(text: string, contextText: string) {
  const lower = text.toLowerCase();
  let eventTime: TimeSlot | null = null;
  let reminderTimes: TimeSlot[] = [];
  let ambiguousHour: number | null = null;
  let ambiguousMinute = 0;
  let ambiguousApproximate = false;

  const eventMatch = lower.match(
    /\b(?:as|while|because)?\s*(?:the\s+)?(?:lunch|dinner|meeting|event|appointment|date|call|match|class)\s+(?:is\s+)?at\s+([\w:.\-\s]+?)(?:$|\.|,|\band\b|\bso\b)/
  );

  if (eventMatch) {
    const extracted = extractTimeCandidates(eventMatch[1], contextText, "event");
    eventTime = extracted.candidates[0] || null;
  }

  const reminderIntent = /\b(reminder|remind|notify|alert)\b/.test(lower);
  const beforeEvent = lower.split(/\b(?:as|while|because)\b/)[0];
  const reminderText = reminderIntent ? beforeEvent : text;
  const source: TimeSlot["source"] = reminderIntent ? "reminder" : "general";
  const extracted = extractTimeCandidates(reminderText, contextText, source);

  reminderTimes = extracted.candidates.filter((candidate) => {
    if (!eventTime) return true;
    return !(candidate.hour === eventTime.hour && candidate.minute === eventTime.minute && source === "general");
  });

  if (extracted.ambiguous.length > 0 && reminderTimes.length === 0) {
    ambiguousHour = extracted.ambiguous[0].hour;
    ambiguousMinute = extracted.ambiguous[0].minute;
    ambiguousApproximate = extracted.ambiguous[0].approximate;
  }

  if (eventTime && reminderTimes.length > 0) {
    reminderTimes = reminderTimes.map((time) => {
      if (time.hour <= 11 && eventTime && eventTime.hour >= 12) {
        return makeTimeSlot(time.hour + 12, time.minute, "reminder", time.approximate);
      }
      return time;
    });
  }

  return {
    eventTime,
    reminderTimes,
    ambiguousHour,
    ambiguousMinute,
    ambiguousApproximate,
  };
}

function cleanTaskText(text: string) {
  let cleaned = text
    .replace(/\b(reminder|remind me|notify me|alert me)\s+(for|about|to)?\b/gi, "")
    .replace(/day after tomorrow/gi, "")
    .replace(/today|tomorrow/gi, "")
    .replace(/\b(this\s+|next\s+)?(sun|sunday|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday)\b/gi, "")
    .replace(/\b(?:on\s+|the\s+)?\d{1,2}(st|nd|rd|th)\b/gi, "")
    .replace(/\bon\s+\d{1,2}\b/gi, "")
    .replace(/\bfor\s+\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/gi, "")
    .replace(/\b\d{1,2}(st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/gi, "")
    .replace(/\b(?:at\s*)?\d{1,2}(?::|\.)\d{2}\s*(am|pm|a\.m\.|p\.m\.)?\b/gi, "")
    .replace(/\bat\s+\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)?\b/gi, "")
    .replace(/\b\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)\b/gi, "")
    .replace(/\b(around|about|approx|approximately|near|roughly)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})(\s*-?\s*ish|ish)?\b/gi, "")
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(\s*-?\s*ish|ish)?\b/gi, "")
    .replace(/\b\d{1,2}(\s*-?\s*ish|ish)\b/gi, "")
    .replace(/\bas\s+.*$/gi, "")
    .replace(/\band then\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned.replace(/^(for|about|to|at|on)\s+/i, "").trim();

  if (/^(reminder|remind|notify|alert)$/i.test(cleaned)) return "";
  return cleaned;
}

function deriveCategory(text: string): ReminderCategory {
  const lower = text.toLowerCase();

  const categoryWords: { category: ReminderCategory; words: string[] }[] = [
    {
      category: "Finance",
      words: ["bill", "payment", "emi", "bank", "tax", "invoice", "salary", "rent", "recharge", "electricity"],
    },
    {
      category: "Health",
      words: ["doctor", "medicine", "meds", "tablet", "gym", "walk", "exercise", "hospital", "health", "appointment"],
    },
    {
      category: "Family",
      words: ["mom", "mother", "dad", "father", "wife", "husband", "son", "daughter", "family", "parents"],
    },
    {
      category: "Travel",
      words: ["flight", "train", "airport", "station", "trip", "travel", "hotel", "cab", "uber", "delhi", "mumbai", "pack"],
    },
    {
      category: "Home",
      words: ["ac", "repair", "plumber", "electrician", "cleaning", "maid", "home", "gas", "groceries"],
    },
    {
      category: "Work",
      words: ["boss", "client", "office", "meeting", "project", "interview", "presentation", "report", "sales", "team", "manager", "work"],
    },
    {
      category: "Social",
      words: ["dinner", "lunch", "party", "movie", "date", "friend", "rohan", "zuzu", "catch up", "coffee"],
    },
    {
      category: "Personal",
      words: ["birthday", "anniversary", "shopping", "personal", "table tennis", "match"],
    },
  ];

  for (const item of categoryWords) {
    if (item.words.some((word) => lower.includes(word))) return item.category;
  }

  return "General";
}

function buildDraft(base: DraftReminder | null, text: string): DraftReminder {
  const namedTask = extractNamedTask(text);
  const rawText = [base?.rawText, text].filter(Boolean).join(" ").trim();
  const contextText = `${base?.title || ""} ${rawText}`.trim();
  const date = extractDate(text);
  const timeData = extractEventAndReminderTimes(text, contextText);

  let title = base?.title || "";
  const cleanedTitle = cleanTaskText(text);

  if (namedTask) {
    title = namedTask;
  } else if (cleanedTitle && !isTimeOnlyNumber(cleanedTitle)) {
    if (!base?.title) title = cleanedTitle;
  }

  const dateISO = date?.dateISO || base?.dateISO || null;
  const dateText = date?.dateText || base?.dateText || "";
  const datePhrase = date?.datePhrase || base?.datePhrase || "";
  const dateAssumed = date?.dateAssumed ?? base?.dateAssumed ?? false;
  const eventTime = timeData.eventTime || base?.eventTime || null;

  let reminderTimes = timeData.reminderTimes.length > 0 ? timeData.reminderTimes : base?.reminderTimes || [];
  let time = reminderTimes[0] || base?.time || null;
  let ambiguousHour = timeData.ambiguousHour ?? base?.ambiguousHour ?? null;
  let ambiguousMinute = timeData.ambiguousMinute || base?.ambiguousMinute || 0;
  let ambiguousApproximate = timeData.ambiguousApproximate || base?.ambiguousApproximate || false;

  const lower = text.toLowerCase().trim();
  if (base?.ambiguousHour !== null && base?.ambiguousHour !== undefined && /^(am|a\.m\.|pm|p\.m\.)$/i.test(lower)) {
    const period = lower.startsWith("p") ? "pm" : "am";
    const finalHour = normalizeHour(base.ambiguousHour, period, "");
    time = makeTimeSlot(finalHour, base.ambiguousMinute, "general", base.ambiguousApproximate);
    reminderTimes = [time];
    ambiguousHour = null;
    ambiguousMinute = 0;
    ambiguousApproximate = false;
  }

  if (time && reminderTimes.length === 0) {
    reminderTimes = [time];
  }

  const dueAt = dueAtFor(dateISO, time);
  const category = deriveCategory(`${title} ${rawText}`);
  const missing: MissingField[] = [];

  if (!title) missing.push("reminder details");
  if (!dateISO) missing.push("date");
  if (!time) missing.push("time");
  if (ambiguousHour !== null) missing.push("ampm");

  return {
    title,
    rawText,
    dateISO,
    dateText,
    datePhrase,
    time,
    reminderTimes,
    eventTime,
    dueAt,
    missing,
    dateAssumed,
    ambiguousHour,
    ambiguousMinute,
    ambiguousApproximate,
    category,
  };
}

function normalizeReminder(item: any): Reminder {
  const normalized: Reminder = {
    id: item.id || createId(),
    title: item.title || "Untitled reminder",
    rawText: item.rawText || item.title || "",
    dateText: item.dateText || "Date missing",
    datePhrase: item.datePhrase || item.dateText || "",
    timeText: item.timeText || "Time missing",
    dueAt: item.dueAt || null,
    status: item.status || "needs_info",
    category: item.category || deriveCategory(`${item.title || ""} ${item.rawText || ""}`),
    createdAt: item.createdAt || new Date().toISOString(),
    notifiedAt: item.notifiedAt || null,
    approximateTime: item.approximateTime || false,
    eventTimeText: item.eventTimeText || "",
  };

  if (normalized.status === "confirmed" && normalized.dueAt && new Date(normalized.dueAt).getTime() < Date.now()) {
    return { ...normalized, status: "archived" };
  }

  return normalized;
}

function isSaveLike(text: string) {
  const lower = text.toLowerCase().trim();
  if (/\bsave it as\b/.test(lower)) return false;

  return ["yes", "save", "save it", "looks good", "go ahead", "perfect", "done", "ok", "okay"].some(
    (word) => lower === word || lower.includes(word)
  );
}

function isChangeLike(text: string) {
  const lower = text.toLowerCase().trim();
  return ["change", "edit", "adjust", "tweak", "modify"].some((word) => lower.includes(word));
}

function isCancelLike(text: string) {
  const lower = text.toLowerCase().trim();
  return ["cancel", "drop it", "not needed", "doesn't work", "doesnt work", "doesn’t work"].some(
    (word) => lower === word || lower.includes(word)
  );
}

function buildQuestion(draft: DraftReminder, seed: number) {
  if (draft.missing.includes("ampm") && draft.ambiguousHour !== null) {
    return `Just confirming — do you mean ${draft.ambiguousHour}:00 AM or ${draft.ambiguousHour}:00 PM?`;
  }

  if (draft.missing.includes("reminder details")) {
    const schedule = [draft.datePhrase, draft.time?.text].filter(Boolean).join(" at ");
    if (schedule) return `Sure — what should I remind you about ${schedule ? `for ${schedule}` : ""}?`;
    return "Sure — what should I remind you about?";
  }

  if (draft.missing.includes("date")) {
    return pickTemplate(
      [
        "Sure — which day should I set this for?",
        "Okay — what date should I use for this?",
        "Got it. Which day would you like this reminder on?",
      ],
      seed
    );
  }

  if (draft.missing.includes("time")) {
    return pickTemplate(
      [
        "Sure — what time should I remind you?",
        "Okay — what time should I set this for?",
        "Got it. What time works for this reminder?",
      ],
      seed
    );
  }

  if (draft.reminderTimes.length > 1 && draft.eventTime) {
    const reminders = draft.reminderTimes.map((item) => item.text).join(" and ");
    return `Got it — ${draft.title} is ${draft.datePhrase} at ${draft.eventTime.text}. You want reminders at ${reminders}. Should I save these reminders, adjust them, or drop them?`;
  }

  const schedule = [draft.datePhrase, draft.time?.text].filter(Boolean).join(", reminder time " );

  return pickTemplate(
    [
      `Perfect — ${draft.title}, ${schedule}. Should I save this reminder, would you like to change something, or does this not work for you?`,
      `This looks ready — ${draft.title}, ${schedule}. Should I go ahead and save it, or would you like to tweak anything?`,
      `Got it — ${draft.title}, ${schedule}. Do you want me to save this reminder, adjust it, or drop it?`,
    ],
    seed
  );
}

function canSaveDraft(draft: DraftReminder | null) {
  if (!draft) return false;
  return Boolean(draft.title && draft.dateISO && draft.time && draft.dueAt && draft.missing.length === 0);
}

function savedMessageFor(reminders: Reminder[]) {
  if (reminders.length > 1) {
    const first = reminders[0];
    return `Done — I’ve saved ${reminders.length} reminders for ${first.title}.`;
  }

  const item = reminders[0];
  const eventText = item.eventTimeText ? ` The event is at ${item.eventTimeText}.` : "";
  return `Done — I’ll remind you about ${item.title} ${item.datePhrase} at ${item.timeText}.${eventText}`;
}

function App() {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<DraftReminder | null>(null);
  const [lastContext, setLastContext] = useState<DraftReminder | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeFilter, setActiveFilter] = useState<ReminderFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [notificationState, setNotificationState] = useState<NotificationState>("unsupported");

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationState(Notification.permission);
    }

    const currentSaved = localStorage.getItem(STORAGE_KEY);
    const oldSaved = OLD_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const saved = currentSaved || oldSaved;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setReminders(Array.isArray(parsed) ? parsed.map(normalizeReminder) : []);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReminders((previous) => {
        const now = Date.now();
        const dueItems: Reminder[] = [];

        return previous.map((item) => {
          const isDue =
            item.status === "confirmed" &&
            item.dueAt &&
            new Date(item.dueAt).getTime() <= now;

          if (isDue) {
            if (!item.notifiedAt) dueItems.push(item);

            return {
              ...item,
              notifiedAt: item.notifiedAt || new Date().toISOString(),
              status: "archived",
            };
          }

          return item;
        }).map((item, index, array) => {
          if (index === array.length - 1) {
            dueItems.forEach((dueItem) => {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Reminder due", { body: dueItem.title });
              } else {
                window.alert(`Reminder due: ${dueItem.title}`);
              }
            });
          }
          return item;
        });
      });
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const visibleReminders = useMemo(() => reminders.filter((item) => item.status !== "archived"), [reminders]);

  const filteredReminders = useMemo(() => {
    const now = new Date();
    const query = searchTerm.trim().toLowerCase();

    return visibleReminders.filter((item) => {
      if (activeFilter === "done" && item.status !== "done") return false;
      if (activeFilter === "today") {
        if (!item.dueAt || !sameDate(new Date(item.dueAt), now)) return false;
      }
      if (activeFilter === "upcoming") {
        if (!item.dueAt || new Date(item.dueAt).getTime() <= now.getTime() || item.status !== "confirmed") return false;
      }
      if (
        !["all", "today", "upcoming", "done"].includes(activeFilter) &&
        item.category !== activeFilter
      ) {
        return false;
      }

      if (!query) return true;

      const haystack = `${item.title} ${item.category} ${item.dateText} ${item.timeText} ${item.eventTimeText || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [visibleReminders, activeFilter, searchTerm]);

  const confirmedCount = useMemo(
    () => visibleReminders.filter((item) => item.status === "confirmed").length,
    [visibleReminders]
  );

  const doneCount = useMemo(
    () => visibleReminders.filter((item) => item.status === "done").length,
    [visibleReminders]
  );

  const draftReadyToSave = canSaveDraft(draft);

  function addMessage(role: "user" | "assistant", text: string) {
    const newMessage: ChatMessage = {
      id: createId(),
      role,
      text,
      createdAt: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, newMessage]);
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }

    const result = await Notification.requestPermission();
    setNotificationState(result);
  }

  function processText(textToProcess: string) {
    const updatedDraft = buildDraft(draft, textToProcess);
    setDraft(updatedDraft);
    addMessage("assistant", buildQuestion(updatedDraft, messages.length + reminders.length));
  }

  function saveCurrentDraft() {
    if (!canSaveDraft(draft) || !draft) {
      if (draft) addMessage("assistant", buildQuestion(draft, messages.length + reminders.length));
      return;
    }

    const timesToSave = draft.reminderTimes.length > 0 ? draft.reminderTimes : [draft.time as TimeSlot];
    const savedItems: Reminder[] = timesToSave.map((time) => ({
      id: createId(),
      title: draft.title,
      rawText: draft.rawText,
      dateText: draft.dateText,
      datePhrase: draft.datePhrase,
      timeText: time.text,
      dueAt: dueAtFor(draft.dateISO, time),
      status: "confirmed",
      category: draft.category,
      createdAt: new Date().toISOString(),
      notifiedAt: null,
      approximateTime: time.approximate,
      eventTimeText: draft.eventTime?.text || "",
    }));

    setReminders((prev) => [...savedItems, ...prev]);
    setLastContext(draft);
    addMessage("assistant", savedMessageFor(savedItems));
    setDraft(null);
    setInput("");
  }

  function handleSubmit(textOverride?: string) {
    const cleanInput = (textOverride ?? input).trim();
    if (!cleanInput) return;

    addMessage("user", cleanInput);

    if (draftReadyToSave && isSaveLike(cleanInput)) {
      saveCurrentDraft();
      setInput("");
      setVoiceMessage("");
      return;
    }

    if (draft && isChangeLike(cleanInput)) {
      setInput(draft.rawText);
      setDraft(null);
      addMessage("assistant", "Sure — make the change and send it again.");
      setVoiceMessage("");
      return;
    }

    if (draft && isCancelLike(cleanInput)) {
      setDraft(null);
      setInput("");
      setVoiceMessage("");
      addMessage("assistant", "No problem — I won’t save it. Tell me the next reminder when ready.");
      return;
    }

    if (draft && /what detail|which detail|what do you need|tell me what/i.test(cleanInput)) {
      addMessage("assistant", buildQuestion(draft, messages.length + reminders.length));
      setInput("");
      return;
    }

    if (!draft && lastContext && /\b(what about|reminder|remind|notify|alert)\b/i.test(cleanInput)) {
      const contextualDraft = buildDraft(lastContext, cleanInput);
      setDraft(contextualDraft);
      addMessage("assistant", buildQuestion(contextualDraft, messages.length + reminders.length));
    } else {
      processText(cleanInput);
    }
    setInput("");
    setVoiceMessage("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleSaveReminder() {
    saveCurrentDraft();
  }

  function handleChangeDraft() {
    if (!draft) return;
    setInput(draft.rawText);
    setDraft(null);
    setVoiceMessage("");
    addMessage("assistant", "Sure — make the change and send it again.");
  }

  function handleDoesNotWork() {
    setDraft(null);
    setInput("");
    setVoiceMessage("");
    addMessage("assistant", "No problem — I won’t save it. Tell me the next reminder when ready.");
  }

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((item) => item.id !== id));
  }

  function handleMarkDone(id: string) {
    setReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "done" ? "confirmed" : "done",
            }
          : item
      )
    );
  }

  function handleStartEdit(item: Reminder) {
    setEditingId(item.id);
    setEditText(item.rawText || item.title);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function handleSaveEdit(id: string) {
    const updated = buildDraft(null, editText);

    setReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              title: updated.title || item.title,
              rawText: editText,
              dateText: updated.dateText || item.dateText,
              datePhrase: updated.datePhrase || item.datePhrase,
              timeText: updated.time?.text || item.timeText,
              dueAt: updated.dueAt || item.dueAt,
              status: canSaveDraft(updated) ? "confirmed" : "needs_info",
              category: updated.category,
              eventTimeText: updated.eventTime?.text || item.eventTimeText,
              notifiedAt: null,
            }
          : item
      )
    );

    setEditingId(null);
    setEditText("");
  }

  function handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceMessage("Voice input is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setVoiceMessage("Listening... speak your reminder now.");
    recognition.start();

    recognition.onresult = (event: any) => {
      const spokenText = event.results[0][0].transcript;
      setIsListening(false);
      setVoiceMessage("");
      handleSubmit(spokenText);
    };

    recognition.onerror = () => {
      setVoiceMessage("Voice capture failed. Please try again or type the reminder.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }

  return (
    <main className="app-shell">
      <section className="conversation-shell">
        <div className="brand-row">
          <div>
            <div className="top-pill">RMS Sprint 1D · Categorisation</div>
            <h1>RemindIQ</h1>
            <p className="tagline">Natural reminders. Smarter follow-through.</p>
          </div>
          <div className="today-card">
            <span>Today</span>
            <strong>{getTodayLabel()}</strong>
          </div>
        </div>

        <div className="utility-row">
          <div className="mini-panel">
            <span>Browser alerts</span>
            <strong className="permission-pill">{notificationState}</strong>
          </div>

          <button className="secondary-button" onClick={requestNotifications} type="button">
            Enable Notifications
          </button>
        </div>

        <div className="chat-panel">
          <div className="chat-thread">
            {messages.length === 0 && (
              <div className="message-row assistant-row">
                <div className="message-bubble assistant-bubble">
                  <span className="message-name">RemindIQ Assistant</span>
                  <p>Hi, I’m ready. Tell me what you want to be reminded about.</p>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "message-row user-row" : "message-row assistant-row"}
              >
                <div className={message.role === "user" ? "message-bubble user-bubble" : "message-bubble assistant-bubble"}>
                  <span className="message-name">{message.role === "user" ? "You" : "RemindIQ Assistant"}</span>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}

            {draftReadyToSave && (
              <div className="message-row assistant-row">
                <div className="action-bubble">
                  <button className="confirm-button" onClick={handleSaveReminder} type="button">
                    Save reminder
                  </button>
                  <button className="quiet-action-button" onClick={handleChangeDraft} type="button">
                    Change something
                  </button>
                  <button className="danger-action-button" onClick={handleDoesNotWork} type="button">
                    Doesn’t work
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={draft ? 'Reply naturally, e.g. "Tuesday", "pm", or "Save it"' : 'Type a reminder, e.g. "Dinner at 9 pm Tuesday"'}
              rows={2}
            />

            <div className="composer-actions">
              <button className={isListening ? "secondary-button listening" : "secondary-button"} onClick={handleVoiceInput} type="button">
                {isListening ? "Listening..." : "Speak"}
              </button>

              <button className="primary-button" onClick={() => handleSubmit()} type="button">
                Send
              </button>
            </div>

            {voiceMessage && <p className="voice-message">{voiceMessage}</p>}
          </div>
        </div>
      </section>

      <section className="list-card">
        <div className="list-header">
          <div>
            <h2>Saved reminders</h2>
            <p>{confirmedCount} active · {doneCount} done</p>
          </div>
          <span>{filteredReminders.length}</span>
        </div>

        <input
          className="search-box"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search reminders..."
        />

        <div className="filter-row">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={activeFilter === filter.value ? "filter-chip active" : "filter-chip"}
              onClick={() => setActiveFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {filteredReminders.length === 0 ? (
          <div className="empty-state">No reminders in this view.</div>
        ) : (
          <div className="reminder-list">
            {filteredReminders.map((item) => (
              <article key={item.id} className={item.status === "done" ? "reminder-item done-item" : "reminder-item"}>
                <div className="reminder-main">
                  <div className="card-topline">
                    <span className={`category-chip category-${item.category.toLowerCase()}`}>{item.category}</span>
                    <span className={item.status === "done" ? "status-pill done-status" : "status-pill"}>
                      {item.status === "done" ? "Done" : "Active"}
                    </span>
                  </div>

                  {editingId === item.id ? (
                    <div className="edit-box">
                      <textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={3} />
                      <div className="edit-actions">
                        <button className="done-button" onClick={() => handleSaveEdit(item.id)} type="button">
                          Save Edit
                        </button>
                        <button className="quiet-button" onClick={handleCancelEdit} type="button">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3>{item.title}</h3>
                      <p>Reminder: {item.dateText} · {item.timeText}</p>
                      {item.eventTimeText && <p className="event-line">Event: {item.eventTimeText}</p>}
                    </>
                  )}
                </div>

                {editingId !== item.id && (
                  <div className="item-actions">
                    <button className="done-button" onClick={() => handleMarkDone(item.id)} type="button">
                      {item.status === "done" ? "Restore" : "Done"}
                    </button>
                    <button className="quiet-button" onClick={() => handleStartEdit(item)} type="button">
                      Edit
                    </button>
                    <button className="warning-button" onClick={() => handleDelete(item.id)} type="button">
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
