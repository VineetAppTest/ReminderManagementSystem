import { detectReminderIntent, type ReminderIntent } from "./reminderIntentClassifier";
import { applyDateChange, applyRename, applyRepeatChange, applyTimeChange, cancelDraft, formatDraftConfirmation, type ReminderDraft } from "./reminderDraftReducers";

export type EditApplyResult = { draft: ReminderDraft | null; message: string; handled: boolean };

export function shouldEnterEditMode(text: string, activeDraft?: ReminderDraft | null): boolean {
  if (!activeDraft) return false;
  const intent = detectReminderIntent(text);
  return intent.kind === "enter_edit";
}

export function buildEditPrompt(activeDraft: ReminderDraft): string {
  const title = activeDraft.task || "this reminder";
  return `Sure — what would you like to change for ${title}? You can say “name it study time”, “change it to 10 pm”, “1 minute from now”, or “cancel it”.`;
}

export function applyEditIntentToDraft(activeDraft: ReminderDraft, intent: ReminderIntent, now: Date = new Date()): EditApplyResult {
  const draft: ReminderDraft = { ...activeDraft, editMode: true, lastQuestion: "edit" };
  switch (intent.kind) {
    case "cancel": return { draft: cancelDraft(draft), message: "Got it — I’ve cleared this reminder draft. Tell me the next reminder when ready.", handled: true };
    case "save": return { draft: { ...draft, editMode: false, lastQuestion: "confirm" }, message: formatDraftConfirmation(draft, "save"), handled: true };
    case "enter_edit": return { draft, message: buildEditPrompt(draft), handled: true };
    case "rename": { const updated = applyRename(draft, intent.value || intent.rawText); return { draft: updated, message: formatDraftConfirmation(updated, "rename"), handled: true }; }
    case "time_change": { const updated = applyTimeChange(draft, intent.value || intent.rawText, now); return { draft: updated, message: formatDraftConfirmation(updated, "time"), handled: true }; }
    case "date_change": { const updated = applyDateChange(draft, intent.value || intent.rawText, now); return { draft: updated, message: formatDraftConfirmation(updated, "date"), handled: true }; }
    case "repeat_change": { const updated = applyRepeatChange(draft, intent.value || intent.rawText); return { draft: updated, message: formatDraftConfirmation(updated, "repeat"), handled: true }; }
    default: return { draft, message: buildEditPrompt(draft), handled: false };
  }
}
