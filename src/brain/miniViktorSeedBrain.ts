export const MINI_VIKTOR_SEED_BRAIN = {
  version: "2E.0",
  name: "MiniViktor",
  purpose:
    "A specialist reminder reasoning brain for RemindIQ. MiniViktor handles reminder intent, slot filling, guardrails, and natural confirmation.",
  coreSlots: [
    "task",
    "eventDate",
    "eventTime",
    "reminderAlerts",
    "category",
    "pendingClarification",
  ],
  intentPriority: [
    "confirm_save",
    "cancel",
    "change_request",
    "answer_ampm",
    "ask_missing_detail",
    "multiple_dated_reminder_alerts",
    "multiple_reminder_alerts",
    "before_event_reminder",
    "title_update",
    "date_update",
    "time_update",
    "event_update",
    "new_reminder",
  ],
  guardrails: [
    "Never save unless the task exists.",
    "Never save unless at least one reminder alert exists.",
    "Never save an alert that is already in the past.",
    "Never overwrite event time with reminder time.",
    "If event time and reminder time differ, preserve both and show both in confirmation.",
    "If event time exists but no separate reminder time was provided, MiniViktor may default the reminder to the event time, but must explicitly state that assumption before saving.",
    "If multiple reminder alerts are detected, preserve each date-time pair separately.",
    "Multiple reminder candidates must be detected before AM/PM clarification. Never collapse multiple candidates into one.",
    "If a multi-time candidate is ambiguous, resolve each candidate separately using event context and device time before asking.",
    "If AM/PM is ambiguous and context is insufficient, ask a natural clarification.",
    "If unsure, ask one clear follow-up question instead of guessing silently.",
  ],
  typoMap: {
    tomorro: "tomorrow",
    tomrro: "tomorrow",
    tmoro: "tomorrow",
    tmrro: "tomorrow",
    tommorow: "tomorrow",
    tmrw: "tomorrow",
    tmr: "tomorrow",
    todday: "today",
    tdy: "today",
    meetin: "meeting",
    n: "and",
  },
  reminderConnectors: ["and", "then", "and then", "n", "&", ","],
  reminderKeywords: ["reminder", "remind me", "need reminder", "need a reminder", "notify me", "alert me"],
  eventKeywords: ["meeting", "meet", "lunch", "dinner", "appointment", "call", "event", "date"],
  beforeEventPatterns: [
    "half an hour before",
    "half hour before",
    "30 minutes before",
    "30 mins before",
    "an hour before",
    "one hour before",
    "1 hour before",
    "quarter of an hour before",
  ],
  exampleBank: [
    {
      conversation: ["Meeting at 8", "pm", "tomorro", "9 today and 5 tomorro"],
      expected:
        "Task Meeting; event tomorrow at 8 PM; reminder alerts today at 9 PM and tomorrow at 5 PM.",
    },
    {
      conversation: ["Meeting at 7 pm", "today", "6pm n then 6.30"],
      expected:
        "Task Meeting; event today at 7 PM; reminder alerts today at 6 PM and today at 6:30 PM.",
    },
    {
      conversation: ["Meeting at 8", "pm", "today", "3 n 7"],
      expected:
        "Task Meeting; event today at 8 PM; reminder alerts today at 3 PM and today at 7 PM. MiniViktor must not collapse this into one reminder.",
    },
    {
      conversation: ["Team meeting at 5 pm, remind me half an hour before", "today"],
      expected: "Task Team meeting; event today at 5 PM; reminder alert today at 4:30 PM.",
    },
    {
      conversation: ["Lunch with X tomorrow, reminder at 12 and 1 as lunch is at 1.10"],
      expected: "Task Lunch with X; event tomorrow at 1:10 PM; reminder alerts tomorrow at 12 PM and 1 PM.",
    },
  ],
} as const;

export type MiniViktorIntent =
  | "confirm_save"
  | "cancel"
  | "change_request"
  | "answer_ampm"
  | "ask_missing_detail"
  | "multiple_dated_reminder_alerts"
  | "multiple_reminder_alerts"
  | "before_event_reminder"
  | "title_update"
  | "date_update"
  | "time_update"
  | "event_update"
  | "new_reminder"
  | "unknown";
