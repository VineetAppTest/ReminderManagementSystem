import { createEmptyDraft, createRemindersFromDraft, processUserText } from "../lib/reminderEngine";
import type { ReminderDraft } from "../lib/reminderTypes";

export type MiniViktorClockAwareTestCase = {
  id: string;
  name: string;
  nowISO: string;
  conversation: string[];
  expected: {
    eventContains?: string;
    reminderCount?: number;
    reminderContains?: string[];
  };
};

export const MINI_VIKTOR_CLOCK_AWARE_TESTS: MiniViktorClockAwareTestCase[] = [
  {
    id: "mv-clock-001",
    name: "multi dated reminders before tomorrow event while today 6 PM is future",
    nowISO: "2026-05-10T15:00:00+05:30",
    conversation: ["Meeting at 8", "pm", "tomorro", "9 today and 5 tomorro"],
    expected: {
      eventContains: "8:00 pm",
      reminderCount: 2,
      reminderContains: ["today at 9:00 pm", "tomorrow at 5:00 pm"],
    },
  },
  {
    id: "mv-clock-002",
    name: "today bare time must not be silently accepted after it has passed",
    nowISO: "2026-05-10T19:00:00+05:30",
    conversation: ["Meet at 8", "pm", "tomorro", "today 6 and tomorrow 4"],
    expected: {
      eventContains: "8:00 pm",
      reminderCount: 0,
    },
  },
  {
    id: "mv-clock-003",
    name: "multiple reminder times before same day event",
    nowISO: "2026-05-10T12:00:00+05:30",
    conversation: ["Meeting at 7 pm", "today", "6pm n then 6.30"],
    expected: {
      eventContains: "7:00 pm",
      reminderCount: 2,
      reminderContains: ["today at 6:00 pm", "today at 6:30 pm"],
    },
  },
  {
    id: "mv-clock-004",
    name: "bare multi-time candidates before evening event must not collapse",
    nowISO: "2026-05-10T12:00:00+05:30",
    conversation: ["Meeting at 8", "pm", "today", "3 n 7"],
    expected: {
      eventContains: "8:00 pm",
      reminderCount: 2,
      reminderContains: ["today at 3:00 pm", "today at 7:00 pm"],
    },
  },
  {
    id: "mv-clock-005",
    name: "same multi-time input must reject past candidate",
    nowISO: "2026-05-10T18:00:00+05:30",
    conversation: ["Meeting at 8", "pm", "today", "3 n 7"],
    expected: {
      eventContains: "8:00 pm",
      reminderCount: 0,
    },
  },
];

function summarizeDraft(draft: ReminderDraft | null) {
  if (!draft) return "no draft";
  const event = draft.eventAt ? `${draft.eventDatePhrase} at ${draft.eventTimeText}` : "no event";
  const reminders = draft.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`);
  return `event=${event}; reminders=${reminders.join(" | ") || "none"}`;
}

export function runMiniViktorClockAwareArena() {
  return MINI_VIKTOR_CLOCK_AWARE_TESTS.map((test) => {
    let draft: ReminderDraft | null = createEmptyDraft();
    const now = new Date(test.nowISO);
    const transcript: string[] = [];

    for (const turn of test.conversation) {
      const result = processUserText(draft, turn, undefined, { now });
      draft = result.draft;
      transcript.push(`User: ${turn}`);
      transcript.push(`MiniViktor: ${result.assistantText}`);
    }

    const save = draft ? createRemindersFromDraft(draft) : { reminders: [], assistantText: "" };
    const summary = summarizeDraft(draft);
    const reminderSummary = save.reminders.map((reminder) => `${reminder.datePhrase} at ${reminder.timeText}`);

    const eventPass = !test.expected.eventContains || summary.toLowerCase().includes(test.expected.eventContains.toLowerCase());
    const countPass = test.expected.reminderCount === undefined || save.reminders.length === test.expected.reminderCount;
    const remindersPass = !test.expected.reminderContains || test.expected.reminderContains.every((expected) =>
      reminderSummary.join(" | ").toLowerCase().includes(expected.toLowerCase())
    );

    return {
      id: test.id,
      name: test.name,
      passed: eventPass && countPass && remindersPass,
      summary,
      reminderSummary,
      transcript,
    };
  });
}
