# Manual verification after applying 3N.12.6

## 1. Confirm App.tsx changed

Open:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
notepad src\App.tsx
```

Search for:

```text
3N.12.6-P0
```

Search for:

```text
const useNativeAlarmOnly = true;
```

Search for:

```text
scheduleNativeReminderAlarm3N12_5(reminder)
```

All three must be present.

## 2. Build

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

## 3. Test

Create:

```text
set a reminder for 1 minute from now
testing native alarm
yes
```

Then press **Alarm diagnostics**.

Expected diagnostics should show a scheduled time and AlarmClock scheduler.

## 4. Android Studio Logcat

Search Logcat for:

```text
3N.12.5
scheduleAlarm
```

Expected:

```text
[3N.12.5] Calling native scheduleAlarm
[3N.12.5] Native scheduleAlarm result
```
