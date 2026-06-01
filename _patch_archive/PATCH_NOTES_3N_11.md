# RemindIQ 3N.11 Alarm Recovery Patch

## Why this patch exists

The fullscreen/native alarm approach still did not resolve the user-facing issue.

Screenshot evidence:
- Screen shows a broken white WebView surface.
- Alarm UI is only a floating pill: "ALARM RINGING".
- Snooze/Dismiss control surface is missing or incomplete.
- Reminder is not saved under Reminder tab.

This means there are two active failures:

1. Alarm UI failure
   - The app is not rendering a proper full-screen alarm takeover screen.
   - The visible UI is fragmented and not product-grade.

2. Persistence failure
   - Alarm can ring even when reminder is not saved into the Reminder tab.
   - This indicates scheduling is happening before durable save, or save and schedule are not part of one controlled transaction.

## 3N.11 Strategy

Stop relying on fragile native fullscreen as the only route.

Use a WebView-first guaranteed alarm surface:

1. Save reminder first.
2. Only schedule alarm after save succeeds.
3. On due event, open/route to an in-app full-screen alarm surface.
4. If native fullscreen works, it can still deep-link into this same alarm surface.
5. If native fullscreen fails, notification tap still opens the same alarm surface.
6. If app is already open, the route takeover is immediate.

## Product rule

A reminder must never alarm unless it exists in the Reminder tab.

Save-first rule:
- Persist reminder with status `confirmed`.
- Confirm it appears in store/list.
- Then schedule alarm.
- If scheduling fails, keep reminder saved and show scheduling warning.
- If saving fails, do not schedule alarm.

## Build label

Sprint 3N.11 · P0 Alarm Recovery
App version: 3N.11-P0
