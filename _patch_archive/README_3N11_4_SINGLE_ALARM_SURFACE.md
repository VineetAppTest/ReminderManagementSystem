# RemindIQ 3N.11.4 Single Alarm Surface Hotfix

## Problem confirmed from screenshots

Two alarm surfaces are active:

1. Broken first surface:
   - White full-screen panel
   - Floating pill text: `ALARM RINGING`
   - Close button
   - No proper Snooze/Dismiss controls

2. Better second surface:
   - Dark `REMINDER DUE` card
   - Shows reminder title
   - Shows time
   - Snooze 5 min
   - Done / Stop
   - Build label: `Sprint 3N.11.2 P0 Applied Alarm Wiring`

## Root cause

The app is now rendering both:
- the old 3N.11 `AlarmSurface3N11` / `ALARM RINGING` surface
- the better existing `FullScreenAlarm` / `REMINDER DUE` control card

So the right fix is not to go backward through 3N.9 or 3N.10.

The right fix is:
- Keep the working `REMINDER DUE` control surface.
- Disable/remove the broken `ALARM RINGING` surface.
- Update build label to 3N.11.4.

## What this patch does

The PowerShell script:

1. Appends a CSS kill-switch to hide the broken `.ri-alarm-page` / `ALARM RINGING` surface.
2. Updates visible build label to:
   - `Sprint 3N.11.4 · P0 Single Alarm Surface`
   - `3N.11.4-P0`
3. Searches and reports files still containing:
   - `ALARM RINGING`
   - `AlarmSurface3N11`
   - `REMINDER DUE`
4. Keeps the second `REMINDER DUE` control card active.

## Apply

From the project root:

```cmd
powershell -ExecutionPolicy Bypass -File apply_3N11_4_single_alarm_surface_hotfix.ps1
npm.cmd run build
npx.cmd cap sync android
```

Then uninstall old app before testing:

```cmd
adb uninstall com.remindiq.app
```

Then reinstall/run fresh from Android Studio.

## Expected result

At alarm time, you should see only one screen:

- `REMINDER DUE`
- Reminder title
- Time
- Snooze 5 min
- Done / Stop

You should NOT see the old white `ALARM RINGING` screen.
