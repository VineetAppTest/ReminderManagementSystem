/**
 * RemindIQ 3N.10.1 Fullscreen Alarm Bridge
 *
 * Purpose:
 * Keep TypeScript reminder scheduling aligned with the native fullscreen alarm route.
 *
 * Use this when a reminder/alarm is saved and dueAt is known.
 */

export type FullscreenAlarmPayload3N10_1 = {
  reminderId: string;
  title: string;
  timeText: string;
  dueAt: string;
  isAlarm?: boolean;
};

export const REMINDIQ_BUILD_LABEL_3N10_1 =
  "Sprint 3N.10.1 · P0 Parser + Fullscreen Alarm";

export const REMINDIQ_APP_VERSION_3N10_1 = "3N.10.1-P0";

export function shouldUseFullscreenAlarm3N10_1(payload: FullscreenAlarmPayload3N10_1): boolean {
  if (!payload?.reminderId || !payload?.dueAt) return false;

  const dueAtMs = new Date(payload.dueAt).getTime();
  if (!Number.isFinite(dueAtMs)) return false;

  // Use fullscreen for near-term reminders and explicit alarms.
  const msUntilDue = dueAtMs - Date.now();
  return Boolean(payload.isAlarm) || msUntilDue <= 24 * 60 * 60 * 1000;
}

/**
 * Integration note:
 *
 * If your current Capacitor native plugin already has a method like:
 *   NativeAlarm.schedule(...)
 *
 * then route to that existing plugin and pass:
 *   reminderId, title, timeText, dueAt, fullscreen: true
 *
 * If there is no native plugin yet, this file documents the JS-side rule only.
 * The native receiver/activity in this package must still be wired from Android.
 */
export async function scheduleFullscreenAlarm3N10_1(
  payload: FullscreenAlarmPayload3N10_1,
  nativeScheduler?: (payload: FullscreenAlarmPayload3N10_1 & { fullscreen: true }) => Promise<void>
): Promise<boolean> {
  if (!shouldUseFullscreenAlarm3N10_1(payload)) return false;

  if (!nativeScheduler) {
    console.warn(
      "[RemindIQ 3N.10.1] No native fullscreen alarm scheduler provided. Falling back to existing notification path.",
      payload
    );
    return false;
  }

  await nativeScheduler({
    ...payload,
    fullscreen: true,
  });

  return true;
}
