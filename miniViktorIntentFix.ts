/**
 * RemindIQ 3N.9 MiniViktor Intent Parser Hotfix
 *
 * Purpose:
 * Fixes title extraction during reminder drafting, especially:
 * - "name it as reminder" -> "reminder"
 * - "call it medicine" -> "medicine"
 * - "title it water plants" -> "water plants"
 * - plain response while awaiting title: "reminder" -> "reminder"
 *
 * Integration:
 * Wire this before any generic NLP/date parsing step when the draft is waiting for a title.
 */

export type ReminderDraft3N9 = {
  title?: string | null;
  text?: string | null;
  dueAt?: string | Date | null;
  dateLabel?: string | null;
  timeLabel?: string | null;
  status?: "collecting" | "confirming" | "saved" | "dropped" | string;
};

export type ParseContext3N9 = {
  awaitingTitle?: boolean;
  hasResolvedTime?: boolean;
  lastAssistantQuestion?: string | null;
};

const BAD_TITLES = new Set([
  "",
  "as",
  "it",
  "this",
  "that",
  "today",
  "tomorrow",
  "reminder time",
  "name",
  "title",
  "call",
  "save",
  "yes",
  "ok",
  "okay",
]);

function cleanTitle3N9(value: string): string {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[\s:,\-.]+|[\s:,\-.]+$/g, "")
    .trim();
}

export function extractReminderTitle3N9(rawInput: string): string | null {
  const input = cleanTitle3N9(rawInput);
  if (!input) return null;

  const patterns: RegExp[] = [
    /^(?:name|title|label)\s+(?:it|this|the reminder)?\s*(?:as|to|:|-)?\s+(.+)$/i,
    /^(?:call)\s+(?:it|this|the reminder)?\s*(?:as|:|-)?\s+(.+)$/i,
    /^(?:set|keep|make)\s+(?:the\s+)?(?:name|title|label)\s*(?:as|to|:|-)?\s+(.+)$/i,
    /^(?:remind me about|remind me to)\s+(.+)$/i,
    /^(?:about|for)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      const candidate = cleanTitle3N9(match[1]);
      if (isUsableReminderTitle3N9(candidate)) return candidate;
    }
  }

  // While the bot is explicitly waiting for title/content, a short plain phrase is valid.
  if (isUsableReminderTitle3N9(input)) {
    return input;
  }

  return null;
}

export function isUsableReminderTitle3N9(value?: string | null): boolean {
  const candidate = cleanTitle3N9(String(value ?? ""));
  if (!candidate) return false;
  if (BAD_TITLES.has(candidate.toLowerCase())) return false;
  if (candidate.length < 2) return false;

  // Avoid accidentally using pure time/date fragments as titles.
  if (/^\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(candidate)) return false;
  if (/^(in\s+)?\d+\s+(minute|minutes|min|hour|hours|day|days)$/i.test(candidate)) return false;
  if (/^(today|tomorrow|tonight|morning|evening|afternoon)$/i.test(candidate)) return false;

  return true;
}

export function shouldTreatInputAsTitle3N9(
  rawInput: string,
  draft: ReminderDraft3N9,
  context: ParseContext3N9 = {}
): boolean {
  const input = cleanTitle3N9(rawInput);
  if (!input) return false;

  const explicitTitleIntent =
    /^(name|title|label|call|set the name|set name|keep name|make title)\b/i.test(input);

  const draftNeedsTitle = !isUsableReminderTitle3N9(draft.title ?? draft.text);
  const timeAlreadyKnown = Boolean(draft.dueAt || draft.timeLabel || context.hasResolvedTime);

  return explicitTitleIntent || Boolean(context.awaitingTitle && draftNeedsTitle && timeAlreadyKnown);
}

export function applyTitleInputToDraft3N9(
  rawInput: string,
  draft: ReminderDraft3N9,
  context: ParseContext3N9 = {}
): ReminderDraft3N9 {
  if (!shouldTreatInputAsTitle3N9(rawInput, draft, context)) {
    return draft;
  }

  const title = extractReminderTitle3N9(rawInput);
  if (!title) return draft;

  return {
    ...draft,
    title,
    text: title,
    status: "confirming",
  };
}

export function buildConfirmationText3N9(draft: ReminderDraft3N9): string {
  const title = cleanTitle3N9(String(draft.title ?? draft.text ?? ""));
  const datePart = draft.dateLabel ? `${draft.dateLabel}` : "today";
  const timePart = draft.timeLabel ? ` at ${draft.timeLabel}` : "";

  if (!isUsableReminderTitle3N9(title)) {
    return `I have the time${timePart}. What should I remind you about?`;
  }

  return `Perfect — ${title}, ${datePart}${timePart}. Should I save this reminder, adjust it, or drop it?`;
}

export function buildSavedText3N9(draft: ReminderDraft3N9): string {
  const title = cleanTitle3N9(String(draft.title ?? draft.text ?? ""));
  const datePart = draft.dateLabel ? `${draft.dateLabel}` : "today";
  const timePart = draft.timeLabel ? ` at ${draft.timeLabel}` : "";

  if (!isUsableReminderTitle3N9(title)) {
    return `I could not save this yet because the reminder name is missing. What should I remind you about?`;
  }

  return `Done — I’ll remind you about ${title} ${datePart}${timePart}.`;
}
