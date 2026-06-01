# RemindIQ Sprint 3N.8 — Single Alarm UI + Fresh State Reset

## Package type
Drop-in patch for your current 3N.7 RemindIQ project folder. This is not a new standalone project.

## What this fixes
1. Disables the duplicate React/web full-screen alarm overlay inside the Android APK.
2. Keeps one native Android alarm activity as the only lock-screen/full-screen alarm UI.
3. Rebuilds the native alarm activity as a compact dark RemindIQ control card.
4. Snooze 10 min and Done / Stop are visible on the first and only alarm screen.
5. Adds build-version state cleanup so MiniViktor does not resume stale unfinished speech after update/reinstall.
6. Prevents restored old chat messages from being spoken again on launch.

## Install
Copy the patch contents into your current RemindIQ project folder and choose Replace files in destination.

Then run:

```powershell
npm run build
npx cap sync android
npx cap open android
```

Then rebuild/install from Android Studio.

## Version label
The app should show:

Sprint 3N.8 · Single Alarm UI + Fresh State Reset

## First tests
1. Install 3N.8.
2. Open app and confirm version label.
3. Confirm MiniViktor does not continue an old statement.
4. Set: `set an alarm for 1 minute from now`.
5. Lock the phone.
6. Expected: one dark alarm screen only, with Snooze 10 min and Done / Stop visible immediately.
7. Done should stop the alarm and close cleanly.
8. Snooze should stop the alarm and reschedule.

## Important note
The old white/intermediate alarm shell should not appear. If it still appears, the APK is likely still using an older compiled Android activity or the patch was not synced/rebuilt after copy.
