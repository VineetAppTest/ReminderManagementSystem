# RemindIQ 3N.10.1 Fullscreen Alarm Acceptance Tests

## Test 1: locked screen alarm

1. Install fresh APK.
2. Open RemindIQ.
3. Create reminder: `set a reminder for 1 minute from now`.
4. Name it: `test alarm`.
5. Save it.
6. Lock phone screen.
7. Wait for due time.

Expected:
- Screen wakes.
- Fullscreen RemindIQ alarm UI appears.
- UI shows:
  - Reminder title
  - Due time
  - Snooze 5m
  - Dismiss
  - Open RemindIQ

Fail if:
- Only small notification appears.
- Snooze button is missing.
- Screen does not wake.
- UI opens but controls are not visible.

## Test 2: unlocked screen alarm

1. Keep app or another app open.
2. Create reminder for 1 minute from now.
3. Wait.

Expected:
- Fullscreen alarm UI appears over current screen.

## Test 3: snooze

1. When fullscreen UI appears, tap Snooze 5m.

Expected:
- Alarm UI closes.
- Notification is cleared.
- Reminder is rescheduled around 5 minutes later.

## Test 4: dismiss

1. Trigger alarm.
2. Tap Dismiss.

Expected:
- Alarm UI closes.
- Notification is cleared.
- Reminder should not keep ringing.

## Test 5: fallback

On devices where direct fullscreen Activity launch is blocked:
- High-priority alarm notification should still appear.
- Tapping notification should open fullscreen alarm UI.

## Test 6: tab status

Before alarm fires:
- Reminder appears under Upcoming/Active.

After Dismiss/notified:
- Reminder appears under Reminded only after notifiedAt/dismissed status is updated.
