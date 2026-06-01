# RemindIQ Sprint 3M.4 Corrective Build

Build label shown in app: `Sprint 3M.4 Corrective Build — Fullscreen Done/Audio/Version Fix`.

## Included fixes
1. Full-screen alarm is now a single-screen experience in the React app.
2. Snooze and Done / Stop controls are on the full-screen alarm itself.
3. Done / Stop now performs a stronger audio cleanup path:
   - stops in-app alarm tone,
   - cancels browser speech synthesis,
   - stops MiniViktor TTS when available,
   - calls the Android native alarm stop bridge when available.
4. Android native full-screen alarm UI has been rebuilt into a compact, high-contrast single card.
5. Android native Done / Stop cancels the ringing service and clears alarm notifications.
6. Version/build label is visible under the RemindIQ app name and on the full-screen alarm.
7. Repeat clarification is hardened: `Repeat reminder for today starting in 1 min` asks for the repeat gap instead of assuming a 1-minute repeat interval.
8. Native repeat scheduling now receives repeat end-date metadata so `today only` repeats do not continue into the next day.

## Mandatory checks
Run:

```bash
npm.cmd install
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then test:

1. Create an alarm 1 minute from now. When full-screen alarm opens, tap Done / Stop. Audio must stop and no second control page should open.
2. Create an alarm 1 minute from now. Tap Snooze. Audio must stop and snoozed alarm/reminder should be scheduled.
3. Create a long-title reminder and confirm the full-screen alarm text wraps cleanly.
4. Confirm the app header shows `Sprint 3M.4 Corrective Build — Fullscreen Done/Audio/Version Fix`.
5. Confirm the full-screen alarm shows `Sprint 3M.4`.
6. Test: `Repeat reminder for today starting in 1 min`. MiniViktor should ask how often it should repeat.
7. Reply: `every 1 hour`. MiniViktor should keep first ring as 1 minute from now and repeat every 1 hour.
