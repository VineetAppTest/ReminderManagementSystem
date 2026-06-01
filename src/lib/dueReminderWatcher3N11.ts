/**
 * RemindIQ 3N.11 Due Reminder Watcher
 *
 * Purpose:
 * If the app/WebView is active, route due reminders to the full-screen
 * in-app alarm surface immediately.
 */

import {
  getDueReminders3N11,
  markReminderRinging3N11,
} from "./reminderStore3N11";

export type AlarmRouteFn3N11 = (reminderId: string) => void;

let watcherHandle3N11: number | null = null;

export function startDueReminderWatcher3N11(routeToAlarm: AlarmRouteFn3N11) {
  stopDueReminderWatcher3N11();

  watcherHandle3N11 = window.setInterval(() => {
    const due = getDueReminders3N11();

    if (!due.length) return;

    const next = due[0];
    markReminderRinging3N11(next.id);
    routeToAlarm(next.id);
  }, 1000);

  return () => stopDueReminderWatcher3N11();
}

export function stopDueReminderWatcher3N11() {
  if (watcherHandle3N11 !== null) {
    window.clearInterval(watcherHandle3N11);
    watcherHandle3N11 = null;
  }
}
