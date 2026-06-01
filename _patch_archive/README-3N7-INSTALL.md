# RemindIQ Sprint 3N.7 — Lock-Screen Alarm UI Reset

This is a drop-in patch for the current 3N.6 folder.

## Install
1. Unzip this package.
2. Copy the folders/files into your current RemindIQ project folder.
3. Choose Replace files in destination.
4. Run:

```powershell
npm run build
npx cap sync android
npx cap open android
```

5. Rebuild/install from Android Studio.

## What changed
- Replaces the native lock-screen alarm activity with one compact dark RemindIQ control card.
- Removes the large white panels seen on the locked screen.
- Keeps Snooze 10 min and Done / Stop visible on the same screen.
- Keeps one-screen rule: no second control page.
- Updates app label to Sprint 3N.7.

## First test
1. Lock phone screen.
2. Set alarm for 1 minute from now.
3. Wait for full-screen alarm.

Expected: dark RemindIQ lock-screen card, readable text, Snooze and Done visible.
