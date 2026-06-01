# RemindIQ Sprint 3M.7 — P0 Single-Surface Alarm Fix

## Purpose
This build addresses the P0 blocker where two alarm/control screens could still appear.

## Core design decision
For the Android APK, there must be only one alarm control surface: the native `RemindIqAlarmActivity` screen with Snooze and Done/Stop controls.

## Fixes included
1. Disabled the in-app/web `FullScreenAlarm` overlay inside the Android native shell.
2. Disabled browser `new Notification(...)` due alerts inside the Android native shell.
3. Removed Capacitor LocalNotification action fallback from scheduled notifications.
4. Removed Android `setFullScreenIntent(...)` from the foreground notification to prevent Android's system notification surface from acting like a first screen.
5. Kept the foreground notification only as the Android service requirement and backup tap target.
6. Native alarm activity remains the single screen with Snooze and Done/Stop.
7. Build label updated to Sprint 3M.7 Native Single Screen.

## Mandatory P0 test
1. Create alarm 1 minute from now.
2. Save.
3. Wait for alarm.
4. Expected: only one RemindIQ alarm control screen appears.
5. Expected: Snooze and Done/Stop are visible on that same screen.
6. Tap Done/Stop.
7. Expected: audio stops immediately.
8. Expected: screen closes cleanly.
9. Expected: no second control page, no white Snooze-only screen, no extra alarm screen.

## Repeat alarm test
1. Create repeating alarm 1 minute from now, repeats every 1 hour, today only.
2. Save.
3. Wait for alarm.
4. Expected: same single-screen behavior.
5. Tap Done/Stop.
6. Expected: current ring stops cleanly; no extra screen opens.

## Important install instruction
Before testing this build, uninstall the previous RemindIQ APK from the phone, then install this build fresh. Old Android notification channels/pending intents can survive normal reinstall paths and confuse P0 alarm testing.
