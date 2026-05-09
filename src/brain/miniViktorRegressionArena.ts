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
