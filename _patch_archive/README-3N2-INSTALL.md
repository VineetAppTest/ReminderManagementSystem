# RemindIQ Sprint 3N.2 — Native Alarm Actions + Firebase Feedback Adapter

This is a drop-in patch for your current 3N/3N.1 folder. It is not a standalone replacement project.

## What this patch changes

### P0 Native Alarm Actions
- Adds native Android full-screen intent support to the ringing alarm notification.
- Keeps Snooze 10 min and Done / Stop as native notification actions.
- Updates the native alarm control screen layout so controls are grouped together and labels are readable.
- Updates Android alarm channel to `remindiq_native_alarm_actions_v6` so the app gets a fresh high-priority alarm channel.

### Feedback Repository Adapter
- Keeps Supabase support from 3N.
- Adds Firebase Firestore support as the recommended path.
- Adds Google Sheets webhook fallback support.
- Adds `VITE_FEEDBACK_PROVIDER=firebase|supabase|sheets`.

## Install steps

1. Unzip this patch.
2. Copy the full contents of this patch into your current RemindIQ project folder.
3. Choose **Replace files in destination**.
4. Run:

```powershell
npm run build
npx cap sync android
npx cap open android
```

5. Reinstall/run the app from Android Studio.

## Expected build label

The app should show:

```text
Sprint 3N.2 · Native Alarm Actions + Firebase Feedback Adapter
```

## Immediate alarm tests

### Test 1: Native notification actions
Say:

```text
set an alarm for 1 minute from now
```

Expected:
- Alarm appears in Reminder list.
- When it fires, Android notification should show Snooze and Done / Stop actions.
- Tapping Done / Stop should stop audio.
- Tapping Snooze should stop audio and reschedule for 10 minutes.
- If Android allows full-screen intent, the native alarm screen opens automatically.
- If Android restricts full-screen launch, tapping notification opens the native control screen.

### Test 2: Control layout
When the control screen appears:
- Snooze and Done should be grouped together in one action row.
- Category/status label should be readable.
- No sparse vertical button layout.

## Firebase setup

Create or update `.env` in your project root:

```env
VITE_FEEDBACK_PROVIDER=firebase
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_FEEDBACK_COLLECTION=remindiq_feedback_items
```

After editing `.env`, rerun:

```powershell
npm run build
npx cap sync android
```

## Firebase Firestore Rules for beta

Use a locked-down beta rule. Example temporary anonymous-write rule for the feedback collection:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /remindiq_feedback_items/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }
  }
}
```

This is acceptable for beta issue capture only. For production, add App Check/Auth and stricter validation.

## Notes

Android may restrict automatic full-screen launch depending on device, OS version, notification permission, lock-screen state, battery settings, and full-screen intent permission. This patch adds the native path and action controls; device settings can still affect auto-launch behavior.
