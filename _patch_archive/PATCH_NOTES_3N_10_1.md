# RemindIQ 3N.10.1 Fullscreen Alarm UI Hotfix

## Purpose

This patch extends the current 3N.10 parser/state hotfix by addressing the unresolved fullscreen alarm UI issue.

Reported problem:
- Fullscreen alarm UI still does not match the expected lock-screen alarm experience.
- Snooze button is missing.
- Second/control screen is missing.
- Reminder/alarm may behave like a normal notification instead of a true fullscreen alarm surface.

## Required behavior

When an alarm/reminder is due:

1. If device is locked:
   - Wake screen.
   - Show fullscreen alarm Activity over lock screen.
   - Show clear title/time.
   - Show primary controls:
     - Snooze
     - Dismiss
     - Open RemindIQ

2. If device is unlocked:
   - Show the same fullscreen alarm Activity, not only a small notification.

3. If Android blocks fullscreen launch due to OEM/battery/background rules:
   - Fallback to a high-priority notification with fullscreen intent.

4. Controls must work:
   - Snooze should reschedule by default 5 minutes.
   - Dismiss should stop alarm and mark notification/reminder handled.
   - Open RemindIQ should return user to app.

## Important Android reality check

A reliable fullscreen alarm cannot be fixed only in React/TypeScript.

It requires native Android files:
- AndroidManifest.xml permissions/activity declarations
- A native FullScreenAlarmActivity
- A native BroadcastReceiver for due alarm routing
- NotificationChannel configured as alarm/urgent
- PendingIntent with fullScreenIntent
- Lock-screen flags: showWhenLocked, turnScreenOn, dismissKeyguard where possible

## Files included

1. `android/FullScreenAlarmActivity.kt`
2. `android/AlarmDueReceiver.kt`
3. `android/AndroidManifest.patch.xml`
4. `android/activity_full_screen_alarm.xml`
5. `android/remindiq_alarm_styles.xml`
6. `src/fullscreenAlarmBridge3N10_1.ts`
7. `src/fullscreenAlarmAcceptanceTests3N10_1.md`
8. `integration_instructions_3N10_1.md`

## Build label

Update to:

- Build label: `Sprint 3N.10.1 · P0 Parser + Fullscreen Alarm`
- App version: `3N.10.1-P0`
