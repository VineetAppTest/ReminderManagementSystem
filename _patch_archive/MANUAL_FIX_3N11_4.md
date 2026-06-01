# Manual Fix Alternative

If you do not want to run the script, do this manually.

## 1. Keep the second control screen

The screen that says `REMINDER DUE` is the one to keep.

## 2. Disable the broken first screen

Open:

```text
src/App.css
```

or:

```text
src/index.css
```

Add:

```css
/* RemindIQ 3N.11.4 - disable duplicate broken alarm surface */
.ri-alarm-page,
.ri-alarm-page[role="dialog"],
.ri-alarm-bg-pulse {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
```

If this file exists:

```text
src/components/alarmSurface3N11.css
```

Add the same CSS at the top.

## 3. Search old surface

Run:

```cmd
findstr /S /I "ALARM RINGING AlarmSurface3N11 REMINDER DUE FullScreenAlarm" src\*
```

Expected:
- `REMINDER DUE` / `FullScreenAlarm` can remain.
- `ALARM RINGING` / `AlarmSurface3N11` should not be the active screen.

## 4. Build

```cmd
npm.cmd run build
npx.cmd cap sync android
adb uninstall com.remindiq.app
```
