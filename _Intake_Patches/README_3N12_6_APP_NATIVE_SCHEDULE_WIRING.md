# RemindIQ 3N.12.6 App Native Schedule Wiring Patch

## What was wrong

Your `App.tsx` already imports:

```ts
import { scheduleNativeReminderAlarm3N12_5 } from "./native/nativeAlarmBridge3N12_5";
```

But the active `scheduleNativeAlarm(reminder)` function still contains the old 3N.11.6 logic:

```ts
// native Android AlarmManager/full-screen scheduling is intentionally disabled
if (isAndroidNativeShell()) {
  setAlarmCapability("Native Android full-screen scheduling disabled in 3N.11.6.");
  return;
}
```

So the app shows a 3N.12 label, but the native alarm path is still disabled.

## What this patch does

1. Updates build label to:
   - `3N.12.6-P0`
   - `Sprint 3N.12.6 · P0 Native Schedule Wired`

2. Sets:
   - `const useNativeAlarmOnly = true;`

3. Replaces `scheduleNativeAlarm(reminder)` with native scheduling logic:
   - validates dueAt
   - requests/checks Android alarm permissions
   - calls `scheduleNativeReminderAlarm3N12_5(reminder)`
   - updates alarm status/capability
   - falls back to web notification only on web/PWA

4. Ensures `src/native/nativeAlarmBridge3N12_5.ts` exists.

5. Ensures AndroidManifest includes native alarm declarations.

## Apply steps

From PowerShell:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
powershell -ExecutionPolicy Bypass -File apply_3N12_6_app_native_schedule_wiring.ps1
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then run from Android Studio.

## Expected logs

After saving a reminder, Android Studio Logcat should show:

```text
[3N.12.5] Calling native scheduleAlarm
[3N.12.5] Native scheduleAlarm result
```

If these logs appear, React is finally calling the native scheduler.
