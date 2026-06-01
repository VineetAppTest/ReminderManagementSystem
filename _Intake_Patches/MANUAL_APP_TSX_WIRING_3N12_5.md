# Manual wiring step for App.tsx

After running the script, you must wire the native schedule call into the save flow.

## Step 1: Open App.tsx

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
notepad src\App.tsx
```

## Step 2: Add import near the top

```ts
import { scheduleNativeReminderAlarm3N12_5 } from "./native/nativeAlarmBridge3N12_5";
```

## Step 3: Find the reminder save point

Search for:

```text
Done
```

or:

```text
saveReminder
```

or:

```text
setReminders
```

or:

```text
confirmed
```

You are looking for the code that runs when user says `yes` and the reminder gets saved.

## Step 4: Add native schedule call immediately after save

If the saved reminder variable is called `savedReminder`, add:

```ts
scheduleNativeReminderAlarm3N12_5(savedReminder).catch((error) => {
  console.error("[3N.12.5] Native alarm schedule failed", error);
});
```

If the variable is called `reminder`, use:

```ts
scheduleNativeReminderAlarm3N12_5(reminder).catch((error) => {
  console.error("[3N.12.5] Native alarm schedule failed", error);
});
```

## Step 5: Build

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

## Step 6: Verify

In Android Studio Logcat, after saving a reminder, look for:

```text
[3N.12.5] Calling native scheduleAlarm
[3N.12.5] Native scheduleAlarm result
```
