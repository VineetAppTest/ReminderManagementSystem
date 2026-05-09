import { createEmptyDraft, createRemindersFromDraft, processUserText } from "../lib/reminderEngine";
import type { ReminderDraft } from "../lib/reminderTypes";

export type MiniViktorRegressionCategory =
  | "candidate_compliance"
  | "visible_inference"
  | "event_vs_reminder"
  | "before_event"
  | "date_typo"
  | "weekday"
  | "past_guard"
  | "multiple_dates"
  | "general";

export type MiniViktorExpectedAlert = {
  datePhrase?: string;
  timeText?: string;
};

export type MiniViktorRegressionCase = {
  id: string;
  category: MiniViktorRegressionCategory;
  name: string;
  nowISO: string;
  turns: string[];
  expected: {
    taskIncludes?: string;
    eventDatePhrase?: string;
    eventTimeText?: string;
    alertCount?: number;
    alerts?: MiniViktorExpectedAlert[];
    mustAskForInferenceConfirmation?: boolean;
    mustNotBeReadyToSave?: boolean;
  };
  mustPassBeforeCalendar: boolean;
};

export type MiniViktorRegressionResult = {
  id: string;
  category: MiniViktorRegressionCategory;
  name: string;
  passed: boolean;
  mustPassBeforeCalendar: boolean;
  failures: string[];
  transcript: string[];
  actual: {
    task: string;
    eventDatePhrase: string;
    eventTimeText: string;
    alertCount: number;
    alerts: string[];
    pendingInference: boolean;
    pendingAMPM: boolean;
    saveableReminderCount: number;
  };
};

export type MiniViktorRegressionReport = {
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  criticalFailed: number;
  byCategory: Record<string, { total: number; failed: number }>;
  results: MiniViktorRegressionResult[];
};

export const MINI_VIKTOR_REGRESSION_CASES: MiniViktorRegressionCase[] = [
  {
    id: "mv-reg-001",
    category: "visible_inference",
    name: "visible AM/PM inference gate for earlier reminders",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meet at 7", "pm", "tomorro", "Earlier reminder, today at 7 n tmrw at 5"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "7:00 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "today", timeText: "7:00 pm" },
        { datePhrase: "tomorrow", timeText: "5:00 pm" },
      ],
      mustAskForInferenceConfirmation: true,
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-002",
    category: "candidate_compliance",
    name: "candidate correction keeps two reminders",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: [
      "Meet at 8",
      "pm",
      "tomorrow",
      "reminder for 3 n 7",
      "No, 1st reminder today at 3 and 2nd reminder tomorrow at 7",
    ],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "8:00 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "today", timeText: "3:00 pm" },
        { datePhrase: "tomorrow", timeText: "7:00 pm" },
      ],
      mustAskForInferenceConfirmation: true,
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-003",
    category: "candidate_compliance",
    name: "multi-time same-day reminders before event",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meeting at 8", "pm", "today", "3 n 7"],
    expected: {
      taskIncludes: "meeting",
      eventDatePhrase: "today",
      eventTimeText: "8:00 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "today", timeText: "3:00 pm" },
        { datePhrase: "today", timeText: "7:00 pm" },
      ],
      mustAskForInferenceConfirmation: true,
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-004",
    category: "event_vs_reminder",
    name: "event time preserved with later reminder time",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meeting at 6 pm", "tomorrow however need a reminder at 4"],
    expected: {
      taskIncludes: "meeting",
      eventDatePhrase: "tomorrow",
      eventTimeText: "6:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "4:00 pm" }],
      mustAskForInferenceConfirmation: true,
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-005",
    category: "before_event",
    name: "half an hour before event",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Team meeting at 5 pm, remind me half an hour before", "today"],
    expected: {
      taskIncludes: "team meeting",
      eventDatePhrase: "today",
      eventTimeText: "5:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "today", timeText: "4:30 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-006",
    category: "date_typo",
    name: "tomorro typo becomes tomorrow",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meet at 4", "pm", "tomorro"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "4:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "4:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-007",
    category: "weekday",
    name: "weekday follow-up fills date",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Dinner at 9 pm", "Tuesday"],
    expected: {
      taskIncludes: "dinner",
      eventTimeText: "9:00 pm",
      alertCount: 1,
      alerts: [{ timeText: "9:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-008",
    category: "event_vs_reminder",
    name: "lunch event and multiple reminder alerts",
    nowISO: "2026-05-10T10:00:00+05:30",
    turns: ["Lunch with X tomorrow", "Reminder at 12 and then at 1 as lunch is at 1.10"],
    expected: {
      taskIncludes: "lunch with x",
      eventDatePhrase: "tomorrow",
      eventTimeText: "1:10 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "tomorrow", timeText: "12:00 pm" },
        { datePhrase: "tomorrow", timeText: "1:00 pm" },
      ],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-009",
    category: "past_guard",
    name: "past same-day candidate cannot become save-ready",
    nowISO: "2026-05-10T18:00:00+05:30",
    turns: ["Meeting at 8", "pm", "today", "3 n 7"],
    expected: {
      taskIncludes: "meeting",
      eventDatePhrase: "today",
      eventTimeText: "8:00 pm",
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-010",
    category: "general",
    name: "single complete reminder with explicit tomorrow and time",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Call Raj tomorrow at 7 pm"],
    expected: {
      taskIncludes: "call raj",
      eventDatePhrase: "tomorrow",
      eventTimeText: "7:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "7:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-011",
    category: "weekday",
    name: "dinner with weekday follow-up",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Dinner at 9 pm", "Tuesday"],
    expected: {
      taskIncludes: "dinner",
      eventTimeText: "9:00 pm",
      alertCount: 1,
      alerts: [{ timeText: "9:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-012",
    category: "general",
    name: "doctor appointment next Tuesday morning",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Doctor appointment next Tuesday morning"],
    expected: {
      taskIncludes: "doctor appointment",
      eventTimeText: "9:00 am",
      alertCount: 1,
      alerts: [{ timeText: "9:00 am" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-013",
    category: "general",
    name: "finance evening phrase",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Pay electricity bill Friday evening"],
    expected: {
      taskIncludes: "pay electricity bill",
      eventTimeText: "6:00 pm",
      alertCount: 1,
      alerts: [{ timeText: "6:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-014",
    category: "general",
    name: "missing date and time asks detail without save",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["buy medicine", "what detail do you need?"],
    expected: {
      taskIncludes: "buy medicine",
      alertCount: 0,
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-015",
    category: "date_typo",
    name: "tmrw typo becomes tomorrow",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meet at 9", "pm", "tmrw"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "9:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "9:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-016",
    category: "date_typo",
    name: "tdy typo becomes today",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meet at 9", "pm", "tdy"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "today",
      eventTimeText: "9:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "today", timeText: "9:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-017",
    category: "date_typo",
    name: "tommorow typo becomes tomorrow",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meet at 9", "pm", "tommorow"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "9:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "9:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-018",
    category: "general",
    name: "title correction with call it",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meeting tomorrow at 5 pm", "call it client meeting"],
    expected: {
      taskIncludes: "client meeting",
      eventDatePhrase: "tomorrow",
      eventTimeText: "5:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "5:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-019",
    category: "general",
    name: "missing time asks detail without save",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Lunch tomorrow", "what detail do you need?"],
    expected: {
      taskIncludes: "lunch",
      eventDatePhrase: "tomorrow",
      alertCount: 0,
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-020",
    category: "multiple_dates",
    name: "explicit dated earlier reminders preserve event",
    nowISO: "2026-05-10T08:00:00+05:30",
    turns: ["Meet at 8", "pm", "tomorrow", "earlier reminder today at 7 pm and tomorrow at 6 pm"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "8:00 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "today", timeText: "7:00 pm" },
        { datePhrase: "tomorrow", timeText: "6:00 pm" },
      ],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-021",
    category: "event_vs_reminder",
    name: "explicit reminder time after event time",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meeting at 6 pm", "tomorrow however need a reminder at 4 pm"],
    expected: {
      taskIncludes: "meeting",
      eventDatePhrase: "tomorrow",
      eventTimeText: "6:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "4:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-022",
    category: "before_event",
    name: "30 minutes before event",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Team meeting at 5 pm, remind me 30 minutes before", "today"],
    expected: {
      taskIncludes: "team meeting",
      eventDatePhrase: "today",
      eventTimeText: "5:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "today", timeText: "4:30 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-023",
    category: "before_event",
    name: "15 minutes before event",
    nowISO: "2026-05-10T08:00:00+05:30",
    turns: ["Team meeting at 5 pm, remind me 15 minutes before", "today"],
    expected: {
      taskIncludes: "team meeting",
      eventDatePhrase: "today",
      eventTimeText: "5:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "today", timeText: "4:45 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-024",
    category: "before_event",
    name: "an hour before event",
    nowISO: "2026-05-10T08:00:00+05:30",
    turns: ["Team meeting at 5 pm, remind me an hour before", "today"],
    expected: {
      taskIncludes: "team meeting",
      eventDatePhrase: "today",
      eventTimeText: "5:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "today", timeText: "4:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-025",
    category: "candidate_compliance",
    name: "explicit multi-time same-day reminders",
    nowISO: "2026-05-10T08:00:00+05:30",
    turns: ["Meeting at 8", "pm", "today", "3 pm n 7 pm"],
    expected: {
      taskIncludes: "meeting",
      eventDatePhrase: "today",
      eventTimeText: "8:00 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "today", timeText: "3:00 pm" },
        { datePhrase: "today", timeText: "7:00 pm" },
      ],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-026",
    category: "multiple_dates",
    name: "explicit date-time pairs with dash separator",
    nowISO: "2026-05-10T08:00:00+05:30",
    turns: ["Meet at 8", "pm", "tomorrow", "today - 6 pm n tomorro - 4 pm"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "8:00 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "today", timeText: "6:00 pm" },
        { datePhrase: "tomorrow", timeText: "4:00 pm" },
      ],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-027",
    category: "event_vs_reminder",
    name: "event-time default assumption is visible but saveable",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meet at 8", "pm", "tomorrow"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "8:00 pm",
      alertCount: 1,
      alerts: [{ datePhrase: "tomorrow", timeText: "8:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-028",
    category: "visible_inference",
    name: "bare earlier reminders require visible inference confirmation",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Meet at 8", "pm", "tomorrow", "earlier reminder today at 7 and tomorrow at 6"],
    expected: {
      taskIncludes: "meet",
      eventDatePhrase: "tomorrow",
      eventTimeText: "8:00 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "today", timeText: "7:00 pm" },
        { datePhrase: "tomorrow", timeText: "6:00 pm" },
      ],
      mustAskForInferenceConfirmation: true,
      mustNotBeReadyToSave: true,
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-029",
    category: "weekday",
    name: "ambiguous time gets weekday then AM/PM",
    nowISO: "2026-05-10T12:00:00+05:30",
    turns: ["Date at 9", "Wednesday", "pm"],
    expected: {
      taskIncludes: "date",
      eventTimeText: "9:00 pm",
      alertCount: 1,
      alerts: [{ timeText: "9:00 pm" }],
    },
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-reg-030",
    category: "event_vs_reminder",
    name: "lunch event with explicit PM reminder alerts",
    nowISO: "2026-05-10T10:00:00+05:30",
    turns: ["Lunch with X tomorrow", "Reminder at 12 pm and then at 1 pm as lunch is at 1.10"],
    expected: {
      taskIncludes: "lunch with x",
      eventDatePhrase: "tomorrow",
      eventTimeText: "1:10 pm",
      alertCount: 2,
      alerts: [
        { datePhrase: "tomorrow", timeText: "12:00 pm" },
        { datePhrase: "tomorrow", timeText: "1:00 pm" },
      ],
    },
    mustPassBeforeCalendar: true,
  },
];

function normalise(value: string | undefined | null) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function alertMatches(actual: string, expected: MiniViktorExpectedAlert) {
  const haystack = normalise(actual);
  const dateOk = !expected.datePhrase || haystack.includes(normalise(expected.datePhrase));
  const timeOk = !expected.timeText || haystack.includes(normalise(expected.timeText));
  return dateOk && timeOk;
}

export function runMiniViktorRegressionCase(testCase: MiniViktorRegressionCase): MiniViktorRegressionResult {
  let draft: ReminderDraft | null = createEmptyDraft();
  const now = new Date(testCase.nowISO);
  const transcript: string[] = [];
  let readyToSave = false;

  for (const turn of testCase.turns) {
    const result = processUserText(draft, turn, undefined, { now });
    draft = result.draft;
    readyToSave = result.readyToSave;
    transcript.push(`User: ${turn}`);
    transcript.push(`MiniViktor: ${result.assistantText}`);
  }

  const save = draft ? createRemindersFromDraft(draft) : { reminders: [], assistantText: "" };
  const alertSummary = draft?.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`) || [];
  const failures: string[] = [];
  const expected = testCase.expected;

  if (expected.taskIncludes && !normalise(draft?.task).includes(normalise(expected.taskIncludes))) {
    failures.push(`Task should include "${expected.taskIncludes}" but was "${draft?.task || ""}".`);
  }

  if (expected.eventDatePhrase && normalise(draft?.eventDatePhrase) !== normalise(expected.eventDatePhrase)) {
    failures.push(`Event date should be "${expected.eventDatePhrase}" but was "${draft?.eventDatePhrase || ""}".`);
  }

  if (expected.eventTimeText && normalise(draft?.eventTimeText) !== normalise(expected.eventTimeText)) {
    failures.push(`Event time should be "${expected.eventTimeText}" but was "${draft?.eventTimeText || ""}".`);
  }

  if (expected.alertCount !== undefined && (draft?.alerts.length || 0) !== expected.alertCount) {
    failures.push(`Alert count should be ${expected.alertCount} but was ${draft?.alerts.length || 0}.`);
  }

  if (expected.alerts) {
    for (const expectedAlert of expected.alerts) {
      const found = alertSummary.some((actual) => alertMatches(actual, expectedAlert));
      if (!found) {
        const expectation = [expectedAlert.datePhrase, expectedAlert.timeText].filter(Boolean).join(" at ");
        failures.push(`Missing expected alert: ${expectation}. Actual: ${alertSummary.join(" | ") || "none"}.`);
      }
    }
  }

  if (expected.mustAskForInferenceConfirmation && !draft?.pendingInferenceConfirmation) {
    failures.push("Expected visible AM/PM inference confirmation, but none was pending.");
  }

  if (expected.mustNotBeReadyToSave && readyToSave) {
    failures.push("Expected draft to be blocked from save, but it was ready to save.");
  }

  return {
    id: testCase.id,
    category: testCase.category,
    name: testCase.name,
    passed: failures.length === 0,
    mustPassBeforeCalendar: testCase.mustPassBeforeCalendar,
    failures,
    transcript,
    actual: {
      task: draft?.task || "",
      eventDatePhrase: draft?.eventDatePhrase || "",
      eventTimeText: draft?.eventTimeText || "",
      alertCount: draft?.alerts.length || 0,
      alerts: alertSummary,
      pendingInference: Boolean(draft?.pendingInferenceConfirmation),
      pendingAMPM: Boolean(draft?.pendingAmbiguousTime),
      saveableReminderCount: save.reminders.length,
    },
  };
}

export function runMiniViktorRegressionArena(): MiniViktorRegressionReport {
  const results = MINI_VIKTOR_REGRESSION_CASES.map(runMiniViktorRegressionCase);
  const byCategory: MiniViktorRegressionReport["byCategory"] = {};

  for (const result of results) {
    if (!byCategory[result.category]) byCategory[result.category] = { total: 0, failed: 0 };
    byCategory[result.category].total += 1;
    if (!result.passed) byCategory[result.category].failed += 1;
  }

  const failed = results.filter((result) => !result.passed);

  return {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    criticalFailed: failed.filter((result) => result.mustPassBeforeCalendar).length,
    byCategory,
    results,
  };
}

export function miniViktorReportToText(report: MiniViktorRegressionReport) {
  const lines = [
    "MiniViktor Regression Report",
    `Generated: ${report.generatedAt}`,
    `Passed: ${report.passed}/${report.total}`,
    `Failed: ${report.failed}`,
    `Critical failed: ${report.criticalFailed}`,
    "",
    "Failure categories:",
    ...Object.entries(report.byCategory).map(([category, value]) => `- ${category}: ${value.failed}/${value.total} failed`),
    "",
    "Failed cases:",
    ...report.results
      .filter((result) => !result.passed)
      .map((result) => `- ${result.id} ${result.name}: ${result.failures.join("; ")}`),
  ];

  return lines.join("\n");
}
