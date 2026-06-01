# Sprint 3N.4 Notes

## Sprint name
RemindIQ 3N.4 — True Native Background Alarm Scheduler

## Core fix
This sprint addresses the issue where alarm notifications appeared only after the app was opened. The alarm firing route has been moved to Android native AlarmManager and BroadcastReceiver.

## Design amendment locked
There must be only one alarm control UI.
- Full-screen intent opens the same native control activity.
- Notification body opens the same native control activity.
- Notification actions Snooze/Done do not open extra screens.
- No intermediate white snooze-only screen.
- No duplicate control page.

## Priority
P0: background alarm firing and single control surface.
P1: Firebase feedback remains available from 3N.2/3N.3; no Firebase logic was removed.
