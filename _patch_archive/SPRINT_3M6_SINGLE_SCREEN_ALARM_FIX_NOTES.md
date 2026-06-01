# RemindIQ Sprint 3M.6 — Single-Screen Alarm Fix

## Why this build exists
Sprint 3M.5 still allowed Android's foreground notification action surface to appear as a separate white screen with a Snooze action before the actual RemindIQ control screen. That created the two-screen alarm experience that should have been removed.

## Fixes included
1. **Single alarm control screen only**
   - Removed Snooze / Done action buttons from the Android foreground notification.
   - The notification is now only a silent launcher for the RemindIQ alarm control screen.
   - Snooze and Done live only on the RemindIQ control screen.

2. **Closing alarm screen stops the alarm**
   - If the alarm control screen is closed/backed out/minimized, the native ringing service is stopped.
   - Notification cleanup now uses stronger `cancelAll()` cleanup.

3. **MiniViktor speech should not resume old statements after app reopen**
   - Existing saved assistant messages are no longer spoken again when the app reopens.
   - MiniViktor speaks only new assistant replies added after the app has loaded.

4. **New alarm channel**
   - Changed native alarm channel to `remindiq_native_control_screen_alarms_v2`.
   - This avoids older Android notification-channel behavior carrying forward from the earlier ringing-channel setup.
   - The foreground notification is silent; service-level MediaPlayer handles the alarm sound.

## Build label
`Sprint 3M.6 Single-Screen Alarm Fix — No Notification Action Screen`

## Mandatory test checklist
1. Create alarm for 1 minute from now.
2. When alarm rings, confirm only the RemindIQ control screen is actionable.
3. Confirm there is no separate white Snooze-only screen.
4. Tap Snooze 10 min on the RemindIQ control screen and confirm alarm stops immediately.
5. Create another alarm for 1 minute from now.
6. Tap Done / Stop on the RemindIQ control screen and confirm:
   - audio stops immediately,
   - screen exits cleanly,
   - no secondary alarm control page opens.
7. Create another alarm for 1 minute from now.
8. Close/back out of the alarm screen and confirm the alarm audio stops.
9. Let MiniViktor speak a response, close the app, reopen the app, and confirm it does not continue or replay the old spoken statement.

## Build checks run
- `npm install --no-audit --no-fund`
- `npm run build`
- `npx cap sync android`

Note: Android Gradle build was not run in this environment because this ZIP does not contain the Gradle wrapper files.
