/**
 * RemindIQ 3N.9 Regression Tests
 *
 * These tests are intentionally framework-light.
 * They can be adapted to Vitest/Jest.
 */

import {
  extractReminderTitle3N9,
  applyTitleInputToDraft3N9,
  buildConfirmationText3N9,
  buildSavedText3N9,
  ReminderDraft3N9,
} from "./miniViktorIntentFix";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertIncludes(actual: string, expected: string, label: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${label}\nExpected to include: ${expected}\nActual: ${actual}`);
  }
}

export function run3N9ReminderRegressionTests() {
  assertEqual(extractReminderTitle3N9("name it as reminder"), "reminder", "name it as reminder");
  assertEqual(extractReminderTitle3N9("name it reminder"), "reminder", "name it reminder");
  assertEqual(extractReminderTitle3N9("call it medicine"), "medicine", "call it medicine");
  assertEqual(extractReminderTitle3N9("title it water plants"), "water plants", "title it water plants");
  assertEqual(extractReminderTitle3N9("remind me to pay electricity bill"), "pay electricity bill", "remind me to");
  assertEqual(extractReminderTitle3N9("as"), null, "bad title must be rejected");

  const draft: ReminderDraft3N9 = {
    dueAt: "2026-06-01T17:04:00+05:30",
    dateLabel: "today",
    timeLabel: "5:04 pm",
    status: "collecting",
  };

  const updated1 = applyTitleInputToDraft3N9("reminder", draft, {
    awaitingTitle: true,
    hasResolvedTime: true,
  });

  assertEqual(updated1.title, "reminder", "plain title while awaiting title");
  assertEqual(updated1.status, "confirming", "status moves to confirming");

  const updated2 = applyTitleInputToDraft3N9("name it as reminder", draft, {
    awaitingTitle: true,
    hasResolvedTime: true,
  });

  assertEqual(updated2.title, "reminder", "explicit naming phrase");
  assertIncludes(
    buildConfirmationText3N9(updated2),
    "Perfect — reminder, today at 5:04 pm",
    "confirmation text"
  );
  assertIncludes(
    buildSavedText3N9(updated2),
    "Done — I’ll remind you about reminder today at 5:04 pm",
    "saved text"
  );

  return "3N.9 reminder regression tests passed";
}

// Uncomment for local direct run after adapting module path.
// console.log(run3N9ReminderRegressionTests());
