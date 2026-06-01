# RemindIQ Sprint Alarm 3L Patch Structure

## Base
- `RemindIQ-Sprint-Alarm-3K-MiniViktor-Context-UX-Closeout.zip`

## Output
- `RemindIQ-Sprint-Alarm-3L-MiniViktor-Context-UX-Closeout.zip`

## Files changed

### `src/App.tsx`
- Added `stopAllAudioNow()` hard-stop helper.
- Full-screen alarm actions now call immediate audio shutdown before state changes.
- Added page/app lifecycle audio cleanup hooks.
- Repeating alarm Done path now preserves repeat and attempts next native schedule.
- Extended app-level draft cancellation synonyms.

### `src/App.css`
- Added Sprint 3L full-screen alarm contrast and long-text containment overrides.
- Added stronger in-screen Snooze / Done / Stop Repeat styling.
- Added compact dynamic reminder-card sizing.
- Added mobile-specific layout tightening.

### `src/lib/reminderEngine.ts`
- Extended engine-level draft clear/cancel synonyms.

### `SPRINT_3L_MINIVIKTOR_CONTEXT_UX_CLOSEOUT_RELEASE_NOTES.txt`
- Release notes and validation checklist.

## Acceptance criteria
- Full-screen alarm remains readable with long phrases.
- Snooze and Done are visible on full-screen alarm, not hidden on another screen.
- Done stops alarm audio and marks/dismisses correctly.
- Snooze stops current alarm audio and creates a future snoozed reminder.
- MiniViktor audio stops on app close/background best-effort.
- Repeating alarm cards are compact and dynamic.
- Common cancel phrases clear active draft.
