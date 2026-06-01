# RemindIQ 3N.11 Integration Instructions

## Objective

Close the current alarm issue today by shifting to a reliable product experience:

1. Save reminder first.
2. Confirm it appears under Reminder tab.
3. Then schedule alarm.
4. On alarm due, route to a proper full-screen in-app alarm surface.
5. Native fullscreen/notification becomes a launcher into this surface, not the only UI.

---

## Files

Copy these files into your source folder, preferably:

```text
src/lib/reminderStore3N11.ts
src/lib/reminderSaveTransaction3N11.ts
src/lib/dueReminderWatcher3N11.ts
src/components/AlarmSurface3N11.tsx
src/components/alarmSurface3N11.css
```

---

## 1. Replace save flow

Wherever you currently save/confirm a reminder, use:

```ts
import { saveReminderThenScheduleAlarm3N11 } from "./lib/reminderSaveTransaction3N11";

await saveReminderThenScheduleAlarm3N11(
  {
    title: draft.task || draft.title,
    rawText: draft.rawText,
    dueAt: draft.alerts[0].dueAt,
    timeText: draft.alerts[0].timeText,
    dateText: draft.alerts[0].dateLabel || "Today",
    datePhrase: draft.alerts[0].datePhrase || "today",
    category: draft.category || "General",
    sourceDraftId: draft.id,
    isAlarm: draft.isAlarm,
  },
  async (reminder) => {
    // call your existing notification/native scheduler here
    await scheduleExistingAlarm(reminder);
  }
);
```

Mandatory:
- Do not call alarm scheduler before save.
- Do not clear activeDraft before save verification.
- Do not show "Done" until save succeeds.

---

## 2. Reminder tab must read from persisted reminders

The Reminder tab must use:

```ts
import { getUpcomingReminders3N11 } from "./lib/reminderStore3N11";

const reminders = getUpcomingReminders3N11();
```

Do not read only from visible runtime state. Runtime state resets can hide saved reminders.

---

## 3. Add alarm route/screen

Add a route like:

```tsx
/alarm/:reminderId
```

Render:

```tsx
import AlarmSurface3N11 from "./components/AlarmSurface3N11";

<AlarmSurface3N11
  reminderId={reminderId}
  onClose={() => navigate("/")}
  onOpenApp={() => navigate("/")}
/>
```

This is the guaranteed control surface.

---

## 4. Start due reminder watcher

In app root after startup:

```ts
import { startDueReminderWatcher3N11 } from "./lib/dueReminderWatcher3N11";

useEffect(() => {
  return startDueReminderWatcher3N11((reminderId) => {
    navigate(`/alarm/${reminderId}`);
  });
}, []);
```

This handles the case where the app is open or foregrounded.

---

## 5. Native/notification should deep-link to `/alarm/:id`

If native fullscreen works:
- Open `/alarm/<reminderId>`.

If notification tap is used:
- Open `/alarm/<reminderId>`.

Do not show the old white/pill UI.

---

## 6. Remove broken alarm pill UI

Search for:

```text
ALARM RINGING
```

If this is currently rendered as a small pill/floating banner, remove that old component or route it to `AlarmSurface3N11`.

The screenshot issue is almost certainly from this old partial alarm component.

---

## 7. Build label

Update:

```text
Sprint 3N.11 · P0 Alarm Recovery
3N.11-P0
```

---

## 8. Definition of Done

This cannot be called fixed unless all pass:

1. Create reminder for 1 minute from now.
2. Confirm save.
3. Reminder appears in Reminder tab immediately.
4. Lock/unlock behavior aside, when alarm fires:
   - A full-screen RemindIQ alarm screen appears.
   - It is not a white blank panel.
   - It has Snooze 5m.
   - It has Dismiss.
   - It has Open RemindIQ.
5. Snooze reschedules.
6. Dismiss moves reminder out of Upcoming.
7. Reminder does not disappear from Reminder tab after app restart.

---

## 9. Manual test script

```text
user: set a reminder for 1 minute from now
assistant: Sure — what should I remind you about today at [time]?
user: testing
assistant: Perfect — testing, today at [time]. Should I save this reminder, adjust it, or drop it?
user: yes
assistant: Done — I’ll remind you about testing today at [time].
```

Immediately check:
- Reminder tab contains `testing`.

At due time:
- Alarm full-screen surface opens.
- No broken white/pill UI.
