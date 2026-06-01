# RemindIQ 3N.4 — True Native Background Alarm Scheduler

This is a drop-in patch for the current RemindIQ 3N/3N.3 folder. It is not a standalone project.

## Why this patch exists
3N.3 confirmed that alarms appeared in Reminders, but notifications were triggered only after the app was opened. That means the webview/in-app timer path was still doing the real firing.

3N.4 moves the alarm firing path to Android native AlarmManager using an AlarmClock-style scheduler.

## Files included
- `src/App.tsx`
- `src/components/FullScreenAlarm.tsx`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java`
- `android/app/src/main/java/com/remindiq/app/RemindIqAlarmReceiver.java`
- `android/app/src/main/java/com/remindiq/app/RemindIqAlarmActionReceiver.java`
- `android/app/src/main/java/com/remindiq/app/RemindIqRingingService.java`
- `android/app/src/main/java/com/remindiq/app/RemindIqAlarmActivity.java`

## Install steps
1. Unzip this patch.
2. Copy the contents into your current RemindIQ project folder.
3. Choose **Replace files in destination**.
4. Run:

```powershell
npm run build
npx cap sync android
npx cap open android
```

5. In Android Studio, rebuild/run the app on the phone.

## Version label to confirm
The app should show:

```text
Sprint 3N.4 · True Native Background Alarm Scheduler
```

The native alarm control activity should show:

```text
Sprint 3N.4 True Native Scheduler
```

## What changed
1. Uses native Android `AlarmManager.setAlarmClock(...)` for alarm-class scheduling.
2. Receiver posts the alarm notification directly when the alarm fires.
3. Receiver starts the ringing service only after the notification has already been posted.
4. Notification actions are handled by a dedicated native broadcast receiver:
   - Snooze 10 min
   - Done / Stop
5. Service no longer launches a second activity directly. Full-screen intent and notification body route to the same single alarm screen.
6. The in-app control snooze default is now 10 minutes.
7. Diagnostics now show whether the receiver has actually fired:
   - scheduled time
   - AlarmClock scheduler usage
   - receiver fired time
   - last native action

## Critical acceptance checks
### A. Closed-app background alarm
1. Open RemindIQ.
2. Create: `set an alarm for 1 minute from now`.
3. Confirm it appears in Reminders.
4. Close/minimize the app.
5. Wait for the alarm.

Expected:
- Notification appears without reopening the app.
- Snooze 10 min and Done / Stop are visible on notification where Android shows action buttons.
- Sound/vibration starts unless the phone blocks alarm audio.
- Full-screen opens automatically only if Android allows it.

### B. Single control screen rule
Expected:
- If full-screen opens, it is the only control screen.
- If the notification body is tapped, it opens the same single native alarm screen.
- No extra white snooze-only screen.
- No second control page.

### C. Native actions
Expected:
- Tap Done / Stop from notification: alarm stops and no extra screen opens.
- Tap Snooze 10 min from notification: alarm stops, reschedules, and no extra screen opens.

### D. Diagnostics
Tap/check Alarm diagnostics after an alarm test.
Expected:
- It should show `AlarmClock scheduler`.
- After the alarm fires, it should show `receiver fired` with a time.

## Important note
Android may still block automatic full-screen launch depending on manufacturer/OS settings. The non-negotiable 3N.4 test is whether the native notification fires while the app is closed/backgrounded. Full-screen auto-launch is device-permission dependent, but notification actions must still be available.
