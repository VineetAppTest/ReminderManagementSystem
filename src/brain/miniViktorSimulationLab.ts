import { createEmptyDraft, createRemindersFromDraft, processUserText } from "../lib/reminderEngine";
import type { ReminderDraft } from "../lib/reminderTypes";
import { MINI_VIKTOR_REGRESSION_CASES } from "./miniViktorRegressionArena";
import type { MiniViktorRegressionCase, MiniViktorRegressionCategory } from "./miniViktorRegressionArena";

export type MiniViktorSimulationResult = {
  id: string;
  name: string;
  category: MiniViktorRegressionCategory;
  passed: boolean;
  critical: boolean;
  failures: string[];
  turns: string[];
  assistantReplies: string[];
  finalState: {
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

export type MiniViktorSimulationReport = {
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  criticalFailed: number;
  byCategory: Record<string, { total: number; failed: number }>;
  results: MiniViktorSimulationResult[];
};

function normalise(value: string | undefined | null) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function alertMatches(actual: string, expected: { datePhrase?: string; timeText?: string }) {
  const haystack = normalise(actual);
  const dateOk = !expected.datePhrase || haystack.includes(normalise(expected.datePhrase));
  const timeOk = !expected.timeText || haystack.includes(normalise(expected.timeText));
  return dateOk && timeOk;
}

export function runMiniViktorSimulationCase(testCase: MiniViktorRegressionCase): MiniViktorSimulationResult {
  let draft: ReminderDraft | null = createEmptyDraft();
  let readyToSave = false;
  const now = new Date(testCase.nowISO);
  const assistantReplies: string[] = [];

  for (const turn of testCase.turns) {
    const result = processUserText(draft, turn, undefined, { now });
    draft = result.draft;
    readyToSave = result.readyToSave;
    assistantReplies.push(result.assistantText);
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
    name: testCase.name,
    category: testCase.category,
    passed: failures.length === 0,
    critical: testCase.mustPassBeforeCalendar,
    failures,
    turns: testCase.turns,
    assistantReplies,
    finalState: {
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

export function runMiniViktorSimulationLab(): MiniViktorSimulationReport {
  const results = MINI_VIKTOR_REGRESSION_CASES.map(runMiniViktorSimulationCase);
  const byCategory: MiniViktorSimulationReport["byCategory"] = {};

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
    criticalFailed: failed.filter((result) => result.critical).length,
    byCategory,
    results,
  };
}

export function miniViktorSimulationReportToText(report: MiniViktorSimulationReport) {
  const lines = [
    "MiniViktor Simulation Learning Lab Report",
    `Generated: ${report.generatedAt}`,
    `Passed: ${report.passed}/${report.total}`,
    `Failed: ${report.failed}`,
    `Critical failed: ${report.criticalFailed}`,
    "",
    "Failure categories:",
    ...Object.entries(report.byCategory).map(([category, value]) => `- ${category}: ${value.failed}/${value.total} failed`),
    "",
    "Failed simulations:",
    ...report.results
      .filter((result) => !result.passed)
      .map((result) => `- ${result.id} ${result.name}: ${result.failures.join("; ")}`),
  ];

  return lines.join("\n");
}
