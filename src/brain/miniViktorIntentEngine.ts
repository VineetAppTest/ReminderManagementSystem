import { MINI_VIKTOR_SEED_BRAIN, type MiniViktorIntent } from "./miniViktorSeedBrain";

type DraftContext = {
  hasDraft: boolean;
  hasTask: boolean;
  hasEventDate: boolean;
  hasEventTime: boolean;
  hasAlerts: boolean;
  awaitingAMPM: boolean;
};

export type MiniViktorIntentResult = {
  primaryIntent: MiniViktorIntent;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

export function normaliseWithMiniViktor(input: string) {
  let output = input
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  for (const [wrong, right] of Object.entries(MINI_VIKTOR_SEED_BRAIN.typoMap)) {
    const pattern = new RegExp(`\\b${wrong}\\b`, "gi");
    output = output.replace(pattern, right);
  }

  return output.replace(/\bn\b/gi, "and").trim();
}

function hasDateWord(text: string) {
  return /\b(today|tomorrow|day after tomorrow|this\s+\w+|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|fri|sat|sun)\b/i.test(text);
}

function hasTimeWord(text: string) {
  return /\b(noon|midnight|morning|afternoon|evening|night|\d{1,2}(?:[:.]\d{1,2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(text);
}

function containsMultipleConnectors(text: string) {
  return /\b(and then|then|and)\b|,|&/i.test(text);
}

export function hasMultipleDateTimePairs(input: string) {
  const text = normaliseWithMiniViktor(input).toLowerCase();
  const parts = text
    .replace(/\band then\b/g, " and ")
    .replace(/\bthen\b/g, " and ")
    .replace(/&/g, " and ")
    .replace(/,/g, " and ")
    .split(/\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return false;

  const pairLikeParts = parts.filter((part) => hasTimeWord(part) && (hasDateWord(part) || /^\d{1,2}(?:[:.]\d{1,2})?\s*(am|pm)?$/i.test(part)));
  const dateParts = parts.filter(hasDateWord);
  const timeParts = parts.filter(hasTimeWord);

  return pairLikeParts.length >= 2 || (dateParts.length >= 1 && timeParts.length >= 2);
}

export function classifyMiniViktorIntent(input: string, context: DraftContext): MiniViktorIntentResult {
  const text = normaliseWithMiniViktor(input).toLowerCase();
  const reasons: string[] = [];

  if (/^(yes|save|save it|save reminder|looks good|go ahead|ok|okay|done|perfect)$/i.test(text)) {
    return { primaryIntent: "confirm_save", confidence: "high", reasons: ["explicit save confirmation"] };
  }

  if (/^(no|cancel|drop|drop it|not needed|doesn't work|doesnt work|doesn’t work)$/i.test(text)) {
    return { primaryIntent: "cancel", confidence: "high", reasons: ["explicit cancel"] };
  }

  if (/^(change|change it|edit|edit it|adjust|adjust it|tweak|modify)$/i.test(text)) {
    return { primaryIntent: "change_request", confidence: "high", reasons: ["explicit change command"] };
  }

  if (context.awaitingAMPM && /\b(am|pm|a\.m\.|p\.m\.)\b/i.test(text)) {
    return { primaryIntent: "answer_ampm", confidence: "high", reasons: ["answering AM/PM clarification"] };
  }

  if (/\b(what detail|what do you need|which detail|what else)\b/i.test(text)) {
    return { primaryIntent: "ask_missing_detail", confidence: "high", reasons: ["user asked missing-detail question"] };
  }

  if (/\b(save it as|call it|make it|name it)\b/i.test(text)) {
    return { primaryIntent: "title_update", confidence: "high", reasons: ["title update phrase"] };
  }

  if (hasMultipleDateTimePairs(text)) {
    return { primaryIntent: "multiple_dated_reminder_alerts", confidence: "high", reasons: ["multiple date/time pairs detected"] };
  }

  if (containsMultipleConnectors(text) && hasTimeWord(text) && context.hasDraft) {
    return { primaryIntent: "multiple_reminder_alerts", confidence: "medium", reasons: ["multiple connected time expressions"] };
  }

  if (MINI_VIKTOR_SEED_BRAIN.beforeEventPatterns.some((phrase) => text.includes(phrase))) {
    return { primaryIntent: "before_event_reminder", confidence: "high", reasons: ["before-event phrase detected"] };
  }

  if (hasDateWord(text) && context.hasDraft) {
    reasons.push("date-like answer in active draft");
    if (hasTimeWord(text)) reasons.push("also includes time");
    return { primaryIntent: "date_update", confidence: "medium", reasons };
  }

  if (hasTimeWord(text) && context.hasDraft) {
    return { primaryIntent: "time_update", confidence: "medium", reasons: ["time-like answer in active draft"] };
  }

  if (!context.hasDraft) {
    return { primaryIntent: "new_reminder", confidence: "medium", reasons: ["no active draft"] };
  }

  return { primaryIntent: "unknown", confidence: "low", reasons: ["no strong reminder intent detected"] };
}
