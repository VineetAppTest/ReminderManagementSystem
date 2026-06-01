# RemindIQ 3N.11.5 Direct Single Alarm Surface Patch

## What this patch is

This is a direct replacement patch. It includes actual files under `src/`.

Extract the ZIP into your RemindIQ project root and allow overwrite.

## Why this patch exists

3N.11.2 is active, but two alarm screens are still appearing:

1. Broken duplicate screen:
   - White screen
   - `ALARM RINGING` pill
   - Close button only

2. Working screen:
   - Dark `REMINDER DUE` card
   - Reminder title
   - Time
   - Snooze 5 min
   - Done / Stop

## What this patch does

1. Replaces `src/App.tsx`
   - Version: `3N.11.5-P0`
   - Build label: `Sprint 3N.11.5 · P0 Direct Single Alarm Surface`
   - Keeps `useNativeAlarmOnly = false`

2. Replaces `src/components/FullScreenAlarm.tsx`
   - Keeps the working `REMINDER DUE` control screen
   - Default snooze is 5 minutes
   - Build hint updated to 3N.11.5

3. Replaces `src/components/AlarmSurface3N11.tsx`
   - Makes it render `null`
   - This prevents the duplicate broken first screen even if it is imported somewhere else.

4. Replaces `src/components/alarmSurface3N11.css`
   - Hard-disables old duplicate surface classes.

5. Updates `src/App.css`
   - Adds a global CSS guard to hide the duplicate old alarm surface.

## Apply steps

From the project root, where you see `package.json`, `src`, and `android`:

1. Extract this ZIP into the project root.
2. Allow overwrite when Windows asks.

Then run:

```cmd
npm.cmd run build
npx.cmd cap sync android
adb uninstall com.remindiq.app
```

Then reinstall/run from Android Studio.

## Expected result

Only one alarm screen should appear:

- `REMINDER DUE`
- Reminder title
- Time
- Snooze 5 min
- Done / Stop

The white `ALARM RINGING` screen should not appear.

## Verification search

After applying, run:

```cmd
findstr /S /I "3N.11.5 ALARM RINGING AlarmSurface3N11 REMINDER DUE" src\*
```

Expected:
- `3N.11.5` should be found.
- `REMINDER DUE` / `FullScreenAlarm` should remain.
- `AlarmSurface3N11` may exist but should render `null`.
- `ALARM RINGING` should not be active in a rendered component.
