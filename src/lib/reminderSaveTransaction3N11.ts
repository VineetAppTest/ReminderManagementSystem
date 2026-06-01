/**
 * RemindIQ 3N.11 Save-First Alarm Transaction
 *
 * Purpose:
 * Fixes "alarm rings but reminder is not saved under Reminder tab".
 */

import {
  Reminder3N11,
  saveReminder3N11,
  getReminder3N11,
  updateReminder3N11,
} from "./reminderStore3N11";

export type ScheduleAlarmFn3N11 = (reminder: Reminder3N11) => Promise<void> | void;

export type SaveAndScheduleResult3N11 = {
  reminder: Reminder3N11;
  scheduled: boolean;
  warning?: string;
};

export async function saveReminderThenScheduleAlarm3N11(
  input: Partial<Reminder3N11> & {
    title: string;
    dueAt: string;
    timeText: string;
  },
  scheduleAlarm: ScheduleAlarmFn3N11
): Promise<SaveAndScheduleResult3N11> {
  // 1. Durable save first.
  const saved = saveReminder3N11({
    ...input,
    status: "confirmed",
  });

  // 2. Verify reminder exists before scheduling.
  const verified = getReminder3N11(saved.id);
  if (!verified) {
    throw new Error("Reminder was not persisted. Alarm scheduling blocked.");
  }

  // 3. Schedule alarm only after save verification.
  try {
    await scheduleAlarm(verified);

    const scheduled = updateReminder3N11(verified.id, {
      status: "scheduled",
    });

    return {
      reminder: scheduled,
      scheduled: true,
    };
  } catch (error) {
    // Keep saved reminder visible even if native scheduling fails.
    updateReminder3N11(verified.id, {
      status: "confirmed",
    });

    return {
      reminder: verified,
      scheduled: false,
      warning:
        error instanceof Error
          ? error.message
          : "Alarm scheduling failed, but reminder was saved.",
    };
  }
}
