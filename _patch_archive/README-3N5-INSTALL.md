# RemindIQ Sprint 3N.5 — Compact Alarm Control + Card Overlap Fix

This is a drop-in patch for the current 3N.4 build.

## Fixes included
1. Reminder card overlap fix
   - Removes overlapping Restore/Edit/Delete controls.
   - Forces reminder cards to be content-height based.
   - Keeps action buttons inside each card.
   - Enlarges Done/category labels for readability.

2. Full-screen native alarm control layout fix
   - Reduces vertical spacing.
   - Keeps Snooze and Done/Stop visible on the first screen.
   - Places Snooze and Done/Stop in one compact row.
   - Keeps the one-screen rule: no secondary alarm control page.

3. Web/in-app alarm control layout fix
   - Compact card.
   - Sticky visible action row.
   - Shorter title/detail blocks to keep actions visible.

## Version label
Expected label in the app:

Sprint 3N.5 · Compact Alarm Control + Card Overlap Fix

## Install
Copy this patch into your current RemindIQ project folder and choose Replace files in destination.

Then run:

npm run build
npx cap sync android
npx cap open android

Then rebuild/install from Android Studio.

## First tests
1. Open Reminders.
   - Done alarm cards should not overlap.
   - Restore/Edit/Delete should remain inside each card.

2. Set alarm for 1 minute from now.
   - Full-screen alarm should appear.
   - Snooze 10 min and Done/Stop should both be visible without scrolling on a normal phone screen.
   - Done should stop the alarm.
   - Snooze should reschedule.
