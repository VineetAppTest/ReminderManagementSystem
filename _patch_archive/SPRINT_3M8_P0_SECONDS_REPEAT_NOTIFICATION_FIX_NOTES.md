# RemindIQ Sprint Alarm 3M.8 — P0 Seconds + Repeat Gap + Notification Action Fix

Base: Sprint 3M.7 Native Single Screen

## Fixes included

1. **30-second relative alarms**
   - Supports phrases such as `alarm in 30 seconds from now` and `30 seconds from now` as a follow-up answer.
   - The alert due time is anchored to the actual current time, not rounded to a stale minute-only parser.

2. **Repeat start vs repeat interval separation**
   - `repeat reminder for today starting in 1 minute` now treats `starting in 1 minute` as the first ring time.
   - MiniViktor must ask for the repeat gap instead of assuming `Repeats every 1 minute`.
   - Expected prompt: `How often should it repeat? For example: every 30 minutes or every 1 hour.`

3. **Repeat gap parsing**
   - Supports `at gap of 2 hours`, `gap of 2 hours`, `every 2 hours`, and `after 2 hours` in repeat context.
   - Label now correctly shows `Repeats every 2 hours` instead of defaulting to 1 hour.

4. **Event time correction consistency**
   - If the user changes a default event-time reminder from an old/past time to a new time, MiniViktor now moves the event and the default alert together.
   - Example: `click a selfie at 5:14 pm` → `today` → `then change it to 5:15 pm` should no longer retain event time as 5:14 pm.

5. **Snooze-only fallback mitigation**
   - The custom native alarm control screen still contains both controls.
   - Added notification-level fallback actions for both `Snooze 10 min` and `Done / Stop` in case Android blocks the custom Activity and only shows the system notification surface.
   - This directly addresses the observed `Full screen has only snooze option` condition.

## Mandatory clean-install note

Uninstall the previous RemindIQ app before installing this build. Android can retain old notification channels and pending intents, which can make an old snooze-only notification surface reappear even after the source is fixed.

## Verification commands run

```bash
npm install --no-audit --no-fund
npm run build
npx cap sync android
```

## Regression checks to run

1. `alarm in 30 seconds from now`
   - Expected: alarm is created without asking for day/time again.

2. `alarm in 30 seconds from now` → if asked follow-up, answer `30 seconds from now`
   - Expected: it accepts the relative time and proceeds to confirmation.

3. `repeat reminder for today starting in 1 minute`
   - Expected: asks for repeat gap; must not create `Repeats every 1 minutes`.

4. Follow-up: `every 2 hours`
   - Expected: `Repeats every 2 hours · today only`.

5. `repeat alarm for 7 minutes at gap of 2 hours` → `today only` → `alarm starts in 1 minute`
   - Expected: first alarm starts in 1 minute; repeat gap remains 2 hours.

6. `click a selfie at 5:14 pm` → `today` if past → `then change it to 5:15 pm`
   - Expected: both event and reminder reflect 5:15 pm; no stale 5:14 pm event remains.

7. Native alarm trigger
   - Expected: custom RemindIQ screen shows Snooze and Done/Stop.
   - If Android shows notification fallback instead, notification must show both Snooze and Done/Stop actions.
