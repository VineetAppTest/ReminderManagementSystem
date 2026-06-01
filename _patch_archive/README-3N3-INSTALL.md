# RemindIQ Sprint 3N.3 — Native Alarm Escalation + Compact Cards + Firebase Diagnostics

This is a drop-in patch for the existing RemindIQ 3N/3N.1/3N.2 folder. It is not a standalone replacement project.

## Install

1. Unzip this package.
2. Copy the contents into your current RemindIQ project folder.
3. Choose **Replace files in destination**.
4. From the project folder, run:

```powershell
npm run build
npx cap sync android
npx cap open android
```

Then run/install from Android Studio.

## Build label expected in app

```text
Sprint 3N.3 · Native Alarm Escalation + Compact Cards + Firebase Diagnostics
```

## What changed

### P0 — Native alarm diagnostics and escalation
- Keeps native Snooze 10 min and Done / Stop notification action path.
- Adds Android full-screen capability diagnostics through the native plugin.
- Adds an in-app **Alarm diagnostics** button to show whether Android allows notifications, exact alarms, and full-screen intent.
- If Android blocks full-screen launch, the app now surfaces that as a diagnostic instead of silently failing.

### P1 — Compact Reminder cards
- Removes the excessive fixed-height feel from reminder/alarm cards.
- Groups action buttons in a compact row.
- Increases readability of status/category labels.
- Keeps alarms visible under Reminders.

### P1 — Feedback repository diagnostics
- Feedback screen now shows active provider clearly:
  - Firebase Firestore
  - Supabase
  - Google Sheets webhook
  - Local only
- Shows whether repository keys are configured.

## Mandatory tests

1. Confirm app label shows 3N.3.
2. Save: `set an alarm for 1 minute from now`.
3. Confirm alarm appears compactly in Reminders.
4. Tap **Alarm diagnostics** before and after the alarm fires.
5. When due, verify notification actions are available:
   - Snooze 10 min
   - Done / Stop
6. Tap notification and confirm control opens.
7. If full-screen does not auto-open, check diagnostic text. On Android 14+, full-screen may be blocked by OS/app notification settings.
8. Open Feedback and confirm provider/configuration status.
