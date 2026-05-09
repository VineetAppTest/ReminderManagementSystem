export type ReminderStatus = "confirmed" | "needs_info" | "done" | "archived";

export type ReminderCategory =
  | "Work"
  | "Personal"
  | "Health"
  | "Finance"
  | "Family"
  | "Social"
  | "Travel"
  | "Home"
  | "General";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
};

export type ReminderAlert = {
  id: string;
  dateISO: string;
  dateLabel: string;
  datePhrase: string;
  timeText: string;
  dueAt: string;
  approximate?: boolean;
  inferredPeriod?: "am" | "pm";
  inferredReason?: "event_context" | "device_clock" | "phrase_context";
};

export type Reminder = {
  id: string;
  title: string;
  rawText: string;
  dateText: string;
  datePhrase: string;
  timeText: string;
  dueAt: string | null;
  status: ReminderStatus;
  category: ReminderCategory;
  createdAt: string;
  notifiedAt?: string | null;
  approximateTime?: boolean;
  eventAt?: string | null;
  eventDateText?: string;
  eventTimeText?: string;
  eventPhrase?: string;
  sourceDraftId?: string;
};

export type ReminderDraft = {
  id: string;
  task: string;
  rawText: string;
  eventDateISO: string | null;
  eventDatePhrase: string;
  eventTimeText: string;
  eventAt: string | null;
  alerts: ReminderAlert[];
  category: ReminderCategory;
  pendingAmbiguousTime:
    | {
        hour: number;
        minute: number;
        role: "event" | "alert";
        dateISO: string | null;
        approximate?: boolean;
      }
    | null;
  pendingInferenceConfirmation:
    | {
        alertIds: string[];
        reason: "event_context" | "device_clock" | "phrase_context";
      }
    | null;
  lastQuestion: "task" | "date" | "time" | "ampm" | "confirm" | null;
};

export type LearningMemory = {
  categoryPatterns: Record<string, { category: ReminderCategory; acceptedCount: number }>;
  ampmPatterns: Record<string, { period: "am" | "pm"; acceptedCount: number }>;
  softTimePatterns: Record<string, { hour: number; minute: number; period: "am" | "pm"; acceptedCount: number }>;
};

export type EngineResult = {
  draft: ReminderDraft | null;
  assistantText: string;
  readyToSave: boolean;
  remindersToSave?: Reminder[];
};

export type SaveResult = {
  reminders: Reminder[];
  assistantText: string;
};