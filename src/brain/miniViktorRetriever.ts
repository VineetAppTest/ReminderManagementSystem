import type { ReminderDraft } from "../lib/reminderTypes";

export type MiniViktorSolvedExampleCategory =
  | "visible_inference"
  | "candidate_compliance"
  | "event_vs_reminder"
  | "before_event"
  | "date_typo"
  | "weekday"
  | "past_guard"
  | "multiple_dates"
  | "missing_detail"
  | "general";

export type MiniViktorSolvedExample = {
  id: string;
  category: MiniViktorSolvedExampleCategory;
  title: string;
  pattern: string;
  turns: string[];
  expectedSummary: string;
  tags: string[];
};

export type MiniViktorRetrievedExample = MiniViktorSolvedExample & {
  score: number;
  matchedTokens: string[];
};

export type MiniViktorRetrieverHints = {
  topCategory: MiniViktorSolvedExampleCategory | null;
  topScore: number;
  suggestsMultipleAlerts: boolean;
  suggestsDatedAlerts: boolean;
  suggestsBeforeEvent: boolean;
  suggestsVisibleInference: boolean;
  examples: MiniViktorRetrievedExample[];
};

const MINI_VIKTOR_SOLVED_EXAMPLES: MiniViktorSolvedExample[] = [
  {
    id: "mv-ex-001",
    category: "visible_inference",
    title: "earlier reminders inferred from evening event",
    pattern: "earlier reminder today at 7 and tomorrow at 6",
    turns: ["Meet at 8", "pm", "tomorrow", "earlier reminder today at 7 and tomorrow at 6"],
    expectedSummary: "Event tomorrow 8 PM; ask visible inference confirmation for today 7 PM and tomorrow 6 PM.",
    tags: ["earlier", "today", "tomorrow", "multiple", "inference", "pm"],
  },
  {
    id: "mv-ex-002",
    category: "candidate_compliance",
    title: "bare same-day multi-time reminders",
    pattern: "3 n 7",
    turns: ["Meeting at 8", "pm", "today", "3 n 7"],
    expectedSummary: "Event today 8 PM; preserve two candidate alerts, infer/confirm 3 PM and 7 PM.",
    tags: ["multi-time", "bare", "same-day", "candidate", "inference"],
  },
  {
    id: "mv-ex-003",
    category: "multiple_dates",
    title: "dated multi-reminder pair correction",
    pattern: "1st reminder today at 3 and 2nd reminder tomorrow at 7",
    turns: ["Meet at 8", "pm", "tomorrow", "No, 1st reminder today at 3 and 2nd reminder tomorrow at 7"],
    expectedSummary: "Event tomorrow 8 PM; reminder 1 today 3 PM, reminder 2 tomorrow 7 PM; keep both candidates.",
    tags: ["correction", "today", "tomorrow", "multiple", "candidate"],
  },
  {
    id: "mv-ex-004",
    category: "event_vs_reminder",
    title: "event time first, reminder time later",
    pattern: "tomorrow however need a reminder at 4",
    turns: ["Meeting at 6 pm", "tomorrow however need a reminder at 4"],
    expectedSummary: "Event tomorrow 6 PM; reminder tomorrow 4 PM; preserve event time separately.",
    tags: ["event", "reminder", "preserve", "tomorrow"],
  },
  {
    id: "mv-ex-005",
    category: "before_event",
    title: "half an hour before event",
    pattern: "remind me half an hour before",
    turns: ["Team meeting at 5 pm, remind me half an hour before", "today"],
    expectedSummary: "Event today 5 PM; reminder today 4:30 PM; remove offset phrase from task.",
    tags: ["before", "half-hour", "offset", "event"],
  },
  {
    id: "mv-ex-006",
    category: "before_event",
    title: "30 minutes before event",
    pattern: "remind me 30 minutes before",
    turns: ["Team meeting at 5 pm, remind me 30 minutes before", "today"],
    expectedSummary: "Event today 5 PM; reminder today 4:30 PM.",
    tags: ["before", "30-minutes", "offset"],
  },
  {
    id: "mv-ex-007",
    category: "event_vs_reminder",
    title: "lunch event and reminder alerts",
    pattern: "reminder at 12 and then at 1 as lunch is at 1.10",
    turns: ["Lunch with X tomorrow", "Reminder at 12 and then at 1 as lunch is at 1.10"],
    expectedSummary: "Event tomorrow 1:10 PM; alerts tomorrow 12 PM and 1 PM.",
    tags: ["lunch", "event-time", "multiple", "alerts"],
  },
  {
    id: "mv-ex-008",
    category: "date_typo",
    title: "tomorro typo",
    pattern: "tomorro",
    turns: ["Meet at 4", "pm", "tomorro"],
    expectedSummary: "Normalize tomorro to tomorrow.",
    tags: ["typo", "tomorrow", "date"],
  },
  {
    id: "mv-ex-009",
    category: "weekday",
    title: "weekday follow-up",
    pattern: "Tuesday",
    turns: ["Dinner at 9 pm", "Tuesday"],
    expectedSummary: "Use next Tuesday as date; keep time 9 PM.",
    tags: ["weekday", "date", "follow-up"],
  },
  {
    id: "mv-ex-010",
    category: "missing_detail",
    title: "ask missing detail",
    pattern: "what detail do you need",
    turns: ["Lunch tomorrow", "what detail do you need?"],
    expectedSummary: "Answer that time is missing; do not save.",
    tags: ["missing", "question", "time"],
  },
  {
    id: "mv-ex-011",
    category: "multiple_dates",
    title: "dash separated dated reminders",
    pattern: "today - 6 n tomorro - 4",
    turns: ["Meeting at 8", "pm", "tomorrow", "today - 6 n tomorro - 4"],
    expectedSummary: "Event tomorrow 8 PM; alerts today 6 PM and tomorrow 4 PM, with visible inference.",
    tags: ["dash", "today", "tomorrow", "multiple", "inference"],
  },
  {
    id: "mv-ex-012",
    category: "candidate_compliance",
    title: "explicit inherited period",
    pattern: "6pm n then 6.30",
    turns: ["Meeting at 7 pm", "today", "6pm n then 6.30"],
    expectedSummary: "Event today 7 PM; reminders today 6 PM and 6:30 PM; inherit PM from first candidate.",
    tags: ["multiple", "inherit-period", "same-day"],
  },
];

function normaliseForRetriever(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\btomorro\b|\btommorow\b|\btmrw\b|\btmr\b/g, "tomorrow")
    .replace(/\btdy\b|\btodday\b/g, "today")
    .replace(/\bn\b|&/g, " and ")
    .replace(/[^a-z0-9:.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensFor(text: string) {
  return normaliseForRetriever(text)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hasPhrase(text: string, phrase: string) {
  return normaliseForRetriever(text).includes(normaliseForRetriever(phrase));
}

function scoreExample(query: string, draft: ReminderDraft | null, example: MiniViktorSolvedExample) {
  const queryTokens = new Set(tokensFor(query));
  const exampleText = [example.pattern, example.turns.join(" "), example.tags.join(" ")].join(" ");
  const exampleTokens = new Set(tokensFor(exampleText));
  const matchedTokens = [...queryTokens].filter((token) => exampleTokens.has(token));

  let score = matchedTokens.length;

  if (hasPhrase(query, example.pattern)) score += 12;
  if (/\btoday\b/.test(normaliseForRetriever(query)) && example.tags.includes("today")) score += 2;
  if (/\btomorrow\b/.test(normaliseForRetriever(query)) && example.tags.includes("tomorrow")) score += 2;
  if (/\band\b|\bthen\b|,|-/.test(normaliseForRetriever(query)) && example.tags.includes("multiple")) score += 4;
  if (/\bbefore\b/.test(normaliseForRetriever(query)) && example.category === "before_event") score += 6;
  if (/\breminder\b|\bremind\b|\bneed\b/.test(normaliseForRetriever(query)) && example.tags.includes("alerts")) score += 3;
  if (draft?.eventTimeText && ["event_vs_reminder", "candidate_compliance", "multiple_dates"].includes(example.category)) score += 2;

  return { score, matchedTokens };
}

export function retrieveMiniViktorExamples(
  query: string,
  draft: ReminderDraft | null,
  maxResults = 3
): MiniViktorRetrievedExample[] {
  return MINI_VIKTOR_SOLVED_EXAMPLES
    .map((example) => {
      const { score, matchedTokens } = scoreExample(query, draft, example);
      return { ...example, score, matchedTokens };
    })
    .filter((example) => example.score >= 2)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, maxResults);
}

export function getMiniViktorRetrieverHints(examples: MiniViktorRetrievedExample[]): MiniViktorRetrieverHints {
  const top = examples[0];
  const categories = new Set(examples.map((example) => example.category));

  return {
    topCategory: top?.category || null,
    topScore: top?.score || 0,
    suggestsMultipleAlerts:
      categories.has("candidate_compliance") || categories.has("multiple_dates") || categories.has("event_vs_reminder"),
    suggestsDatedAlerts: categories.has("multiple_dates"),
    suggestsBeforeEvent: categories.has("before_event"),
    suggestsVisibleInference: categories.has("visible_inference"),
    examples,
  };
}

export function getMiniViktorSolvedExamples() {
  return MINI_VIKTOR_SOLVED_EXAMPLES;
}
