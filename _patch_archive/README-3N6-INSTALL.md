# RemindIQ Sprint 3N.6 — Premium Alarm UI + Reminder Card Fit

This is a drop-in patch for the current 3N.5 folder. It is not a standalone project.

## Install
1. Unzip this package.
2. Copy all contents into the current RemindIQ project folder.
3. Choose **Replace files in destination**.
4. Run:

```powershell
npm run build
npx cap sync android
npx cap open android
```

Then rebuild/install from Android Studio.

## Fixes included
- Reminder cards now use content-driven height.
- Restore / Edit / Delete remain visible inside each card.
- Reminder card details are not clipped.
- Full-screen/native alarm screen moved closer to RemindIQ dark premium styling.
- Snooze 10 min and Done / Stop remain visible in the same single control screen.
- Build label updated to Sprint 3N.6.

## First checks
- Open Reminders > Done filter: cards should not clip text or hide buttons.
- Create alarm for 1 minute from now: native/full-screen screen should open, controls visible, Done stops alarm.
