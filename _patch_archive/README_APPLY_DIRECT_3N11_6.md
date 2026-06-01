# RemindIQ 3N.11.6 WebView-Only Alarm Surface Patch

## What this patch fixes

3N.11.5 still shows two full-screen surfaces.

That means the duplicate is no longer just the React `AlarmSurface3N11` component. The remaining duplicate is coming from the native Android alarm/full-screen path.

## Decision

Disable native Android full-screen scheduling and keep only the WebView alarm control surface.

Final expected behavior:

```text
Reminder due
→ show only REMINDER DUE screen
→ Snooze 5 min / Done Stop
→ no Android/native white fullscreen shell
```

## Trade-off

This is a deliberate product decision to close the UI issue.

- Native fullscreen/lock-screen alarm is disabled.
- The in-app WebView alarm surface is the single source of truth.
- The reminder must be in the running app/WebView runtime for the control surface to appear.

This is the cleanest way to remove the two-screen behavior.

## Files replaced

- `src/App.tsx`
- `src/components/FullScreenAlarm.tsx`
- `src/components/AlarmSurface3N11.tsx`
- `src/components/alarmSurface3N11.css`
- `src/App.css`
- `android/app/src/main/AndroidManifest.xml`

## Apply steps

Extract this ZIP into your RemindIQ project root and allow overwrite.

Then run:

```cmd
npm.cmd run build
npx.cmd cap sync android
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" uninstall com.remindiq.app
```

If uninstall fails, uninstall manually from the phone:

```text
Settings → Apps → RemindIQ → Uninstall
```

Then reinstall/run fresh from Android Studio.

## Why uninstall is mandatory

Old native alarms scheduled by 3N.11.5 or earlier can remain pending. If you do not uninstall/clear the app, an old native alarm may still fire and make it look like 3N.11.6 failed.

## Verification

Run:

```cmd
findstr /S /I "3N.11.6 RemindIqAlarmActivity RemindIqAlarmReceiver USE_FULL_SCREEN_INTENT scheduleAlarm REMINDER DUE ALARM RINGING" src\* android\app\src\main\AndroidManifest.xml
```

Expected:

- `3N.11.6` should be visible.
- `REMINDER DUE` should be present.
- `RemindIqAlarmActivity` should NOT be present in AndroidManifest.xml.
- `RemindIqAlarmReceiver` should NOT be present in AndroidManifest.xml.
- `USE_FULL_SCREEN_INTENT` should NOT be present in AndroidManifest.xml.
- `ALARM RINGING` should not be active in any rendered component.

## Acceptance test

1. Open app.
2. Confirm build label shows `3N.11.6-P0`.
3. Set reminder for 1 minute from now.
4. Confirm reminder appears in Reminders tab.
5. Wait with app open.
6. Only one screen appears: `REMINDER DUE`.
7. No extra white fullscreen screen appears.
8. Snooze works.
9. Done / Stop works.
