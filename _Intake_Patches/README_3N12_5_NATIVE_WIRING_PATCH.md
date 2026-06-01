# RemindIQ 3N.12.5 Native Wiring Patch

## Issue

3N.12 build label is visible, but the alarm does not ring and the native fullscreen UI does not appear.

You confirmed two missing pieces:

1. `App.tsx` is not calling native `scheduleAlarm(...)`.
2. AndroidManifest does not contain required native alarm declarations.

That means 3N.12 is currently only a label/build update. The native alarm path is not wired.

## What this patch does

This patch has two parts:

1. Updates `AndroidManifest.xml`
   - Adds required permissions if missing.
   - Adds native alarm Activity, Receiver, ActionReceiver, and RingingService declarations if missing.

2. Adds a native alarm bridge helper in `src/native/nativeAlarmBridge3N12_5.ts`
   - Gives the app a clean function to call:
     `scheduleNativeReminderAlarm3N12_5(reminder)`

## Important limitation

This patch cannot safely auto-edit every possible `App.tsx` save flow without seeing your current full `App.tsx`.

So after applying this patch, one small manual wiring step is required in `App.tsx`:
- Import the helper.
- Call it immediately after a reminder is saved.

The README below gives exact steps.

## Apply

From project root:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
powershell -ExecutionPolicy Bypass -File apply_3N12_5_native_wiring_patch.ps1
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then rebuild/run from Android Studio.

## Manual App.tsx wiring

Open:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
notepad src\App.tsx
```

At the top of the file, add:

```ts
import { scheduleNativeReminderAlarm3N12_5 } from "./native/nativeAlarmBridge3N12_5";
```

Then find the place where a reminder is actually saved after the user confirms `yes`.

It will look like one of these patterns:

```ts
setReminders(...)
```

or:

```ts
saveReminder(...)
```

or:

```ts
const savedReminder = ...
```

Immediately after the reminder is saved, add:

```ts
scheduleNativeReminderAlarm3N12_5(savedReminder).catch((error) => {
  console.error("[3N.12.5] Native alarm schedule failed", error);
});
```

If the variable is called `reminder` instead of `savedReminder`, use:

```ts
scheduleNativeReminderAlarm3N12_5(reminder).catch((error) => {
  console.error("[3N.12.5] Native alarm schedule failed", error);
});
```

## How to know it is working

After creating a reminder, Android Studio Logcat should show:

```text
[3N.12.5] Calling native scheduleAlarm
[3N.12.5] Native scheduleAlarm result
```

If those logs do not appear, App.tsx is still not calling the native scheduler.
