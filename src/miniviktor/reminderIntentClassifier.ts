export type ReminderIntentKind =
  | "save"
  | "cancel"
  | "enter_edit"
  | "rename"
  | "time_change"
  | "date_change"
  | "repeat_change"
  | "unknown";

export type ReminderIntent = {
  kind: ReminderIntentKind;
  rawText: string;
  value?: string;
  confidence: number;
};

const CANCEL_PATTERNS = [
  /\b(scrap that|drop it|cancel it|cancel|ignore|leave it|forget it|discard|delete it|clear it|never mind|nevermind|stop this|abort)\b/i,
];

const SAVE_PATTERNS = [/\b(save|save it|save reminder|confirm|done|yes save|okay save|ok save)\b/i];
const EDIT_PATTERNS = [/\b(change it|change something|adjust it|adjusted|edit it|modify it|update it|correct it|make a change)\b/i];
const NAME_PREFIX_PATTERNS = [/^\s*(?:name(?:\s+the\s+(?:alarm|reminder))?\s+(?:as\s+)?|rename(?:\s+it)?\s+(?:to\s+)?|call(?:\s+it)?\s+)(.+)$/i];
const TIME_CHANGE_PATTERNS = [
  /\b(?:make it|change it to|move it to|set it for|set it to|at|for)\s+((?:\d{1,2})(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\b/i,
  /\b((?:\d{1,2})(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i,
  /\b((?:in\s+)?\d+\s+minutes?\s+from\s+now|\d+\s+minute\s+from\s+now|minute\s+from\s+now|now)\b/i,
];
const DATE_CHANGE_PATTERNS = [/\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i];
const REPEAT_CHANGE_PATTERNS = [/\b(repeat|repeats|repetition|every|daily|weekly|hourly|after\s+\d+\s+hours?|every\s+\d+\s+hours?|today only)\b/i];

export function detectReminderIntent(text: string): ReminderIntent {
  const rawText = text.trim();
  if (!rawText) return { kind: "unknown", rawText, confidence: 0 };

  if (CANCEL_PATTERNS.some((pattern) => pattern.test(rawText))) return { kind: "cancel", rawText, confidence: 0.98 };
  if (SAVE_PATTERNS.some((pattern) => pattern.test(rawText))) return { kind: "save", rawText, confidence: 0.96 };
  if (EDIT_PATTERNS.some((pattern) => pattern.test(rawText))) return { kind: "enter_edit", rawText, confidence: 0.95 };

  for (const pattern of NAME_PREFIX_PATTERNS) {
    const match = rawText.match(pattern);
    if (match?.[1]) return { kind: "rename", rawText, value: cleanTitle(match[1]), confidence: 0.95 };
  }

  for (const pattern of TIME_CHANGE_PATTERNS) {
    const match = rawText.match(pattern);
    if (match?.[1] && isMostlyTimePhrase(rawText, match[1])) {
      return { kind: "time_change", rawText, value: normalizeTimePhrase(match[1]), confidence: 0.9 };
    }
  }

  if (REPEAT_CHANGE_PATTERNS.some((pattern) => pattern.test(rawText))) return { kind: "repeat_change", rawText, value: rawText, confidence: 0.78 };

  const dateMatch = rawText.match(DATE_CHANGE_PATTERNS[0]);
  if (dateMatch?.[1] && rawText.length <= 28) return { kind: "date_change", rawText, value: dateMatch[1].toLowerCase(), confidence: 0.76 };

  if (rawText.split(/\s+/).length <= 8 && !/[?]/.test(rawText)) return { kind: "rename", rawText, value: cleanTitle(rawText), confidence: 0.72 };

  return { kind: "unknown", rawText, confidence: 0.2 };
}

function cleanTitle(value: string): string {
  return value.replace(/^as\s+/i, "").replace(/^to\s+/i, "").trim().replace(/\s+/g, " ");
}

function normalizeTimePhrase(value: string): string {
  return value.replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isMostlyTimePhrase(rawText: string, matchedTime: string): boolean {
  const cleaned = rawText.toLowerCase().replace(/[.,]/g, "").trim();
  const matched = matchedTime.toLowerCase().replace(/[.,]/g, "").trim();
  if (cleaned === matched) return true;
  if ([`make it ${matched}`, `change it to ${matched}`, `set it for ${matched}`].includes(cleaned)) return true;
  if (/^(?:in\s+)?\d+\s+minutes?\s+from\s+now$/.test(cleaned)) return true;
  if (/^\d+\s+minute\s+from\s+now$/.test(cleaned)) return true;
  if (cleaned === "minute from now") return true;
  return /^(make it|change it to|move it to|set it for|set it to)\b/.test(cleaned);
}
