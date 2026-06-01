# RemindIQ Consolidated Test Plan — Post Sprint 3J to Latest 3L

Use this checklist after applying `RemindIQ-Sprint-Alarm-3M-Consolidated-Post-3J-to-3L.zip`.

## 0. Setup and build checks

Run from the RemindIQ project folder:

```bash
npm.cmd install
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Pass criteria:
- Build completes without TypeScript errors.
- Android project opens.
- App installs/opens on device or emulator.
- Existing reminders render without blank screen.

## 1. Built-in MiniViktor test checks

In the app test area, run:
1. Standard regression
2. Corpus regression
3. Simulation Learning Lab
4. Dataset export
5. Copy corpus JSONL

Pass criteria:
- No critical regression failures.
- Known old failures around before-event, multiple-alerts, AM/PM inference, weekday/date phrases, and generated variations should not return.
- Export and copy actions should work without app crash.

## 2. Repeat alarm — relative start + hourly repeat + today only

Test phrases:
- “create repeating alarm 1 minute from now repeats every 1 hour for today only”
- “create a repeating alarm 1 minute from now which repeats everyone for today only”
- “create repeating alarm 1 minute from now receives every one for today only”
- “set a repeat reminder” → “repetition should be after 1 hour and alarm is for 1 minute from now” → “today only”

Pass criteria:
- MiniViktor should infer/start from current time + 1 minute.
- Repeat rule should be every 1 hour.
- End scope should be today only.
- It should not get stuck asking “daily or weekly” when the user has already given an hourly/interval repeat.
- Save should not fail because the first alarm time elapsed during the confirmation flow. If time elapsed, user correction like “1 minute from now” should update from the current time.

## 3. Cancel / scrap / drop active draft

Test phrases while a draft is active:
- “scrap that”
- “drop it”
- “cancel this”
- “ignore it”
- “forget this”
- “start over”
- “discard this reminder”

Pass criteria:
- Active draft is cleared.
- No reminder named “scrap that” or similar is created.
- MiniViktor confirms cancellation and waits for the next reminder.

## 4. Rename / change reminder title while draft is active

Test flow:
1. “a daily reminder for 9:00 am”
2. “change something”
3. “name the alarm as executive study time”
4. “save it”

Also test:
1. “call last tomorrow at 8:00 pm”
2. “change it”
3. “call Raj”
4. “save reminder”

Pass criteria:
- MiniViktor treats the new phrase as a title/name change, not unrelated input.
- Saved reminder title becomes the intended title.
- Original date/time/repeat details are preserved.

## 5. Contextual understanding and recovery

Test phrases while a draft is active:
- “change it”
- “adjust it”
- “make it 10 pm”
- “1 minute from now”
- “today only”
- “save reminder”

Pass criteria:
- MiniViktor should use the active draft context.
- It should not repeatedly say “I don’t think this is related to the current reminder” for clear change/save/cancel/repeat continuation language.
- If genuinely unclear, it should ask a useful clarification and preserve the active draft.

## 6. Past-time and correction guard

Test flow:
1. “meeting tomorrow 8:00 pm remind me today at 7:00 pm and tomorrow at 6:00” after today 7 pm has passed.
2. Then say “make it today 10:00 pm”.

Pass criteria:
- MiniViktor identifies the past reminder time.
- User correction updates the relevant reminder candidate instead of starting a new reminder titled “day”.
- Final saved item keeps the original event context where possible.

## 7. Full-screen alarm UI readability

Test:
- Create an alarm with a long title, e.g. “executive study time preparation for tomorrow morning leadership interview practice”.
- Let the alarm trigger.

Pass criteria:
- Full-screen alarm text wraps correctly.
- No horizontal overflow.
- Text remains readable with strong contrast.
- Background is visually appealing and not same-color as text.
- Long titles do not stretch the screen.

## 8. Full-screen alarm actions

Test on full-screen alarm:
- Tap Snooze.
- Tap Done.
- Try closing the alarm screen.

Pass criteria:
- Snooze is available on the full-screen alarm itself.
- Done is available on the full-screen alarm itself.
- Done stops sound and marks/dismisses the active alarm.
- Snooze stops current sound and reschedules correctly.
- No additional secondary screen should be required for core actions.

## 9. Audio lifecycle

Test:
- Let alarm ring.
- Tap Done.
- Close/minimize the app.
- Reopen the app.

Pass criteria:
- Alarm audio stops immediately after Done.
- Audio does not continue after closing/dismissing the app.
- No duplicate alarm loops start.
- MiniViktor alarm audio should be controlled consistently across foreground/background-like flows.

## 10. Reminder/alarm list dynamic card height

Test with short and long entries:
- “alarm 1 minute from now”
- “executive study time preparation for tomorrow morning leadership interview practice at 9 am”
- repeating alarm every 1 hour today only

Pass criteria:
- Reminder cards do not use excessive fixed height.
- Short cards stay compact.
- Long cards expand only as much as needed.
- Repeat labels are visible but not oversized.

## 11. Voice/misrecognition tolerance

Test phrases:
- “repeats everyone”
- “repeats every one”
- “receives everyone”
- “repeaters today only”
- “minute from now”
- “1 minute from now”

Pass criteria:
- Common Google mic distortions are normalized where safe.
- MiniViktor should not treat these phrases as unrelated when they are part of an active repeat alarm flow.
- Unsafe or unclear inference should trigger a clarification rather than a wrong save.

## 12. Final acceptance checkpoint

Ready for next sprint only when:
- Standard regression passes.
- Corpus regression passes.
- Repeat alarm today-only flow passes manually.
- Scrap/cancel synonyms pass manually.
- Rename/change active draft passes manually.
- Full-screen alarm readability is acceptable on actual Android device.
- Snooze and Done work directly on full-screen alarm.
- Alarm audio stops after Done and app close.
- Reminder list card heights are dynamic and readable.
