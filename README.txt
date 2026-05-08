RemindIQ Sprint 2C Fix 2 - Multiple Reminder Times + Stability Lock

Replace/add all files in your project with the files in this ZIP.

Key fixes:
1. Stops accidental "Change something" trigger unless user clearly asks to change/edit/adjust.
2. Detects explicit reminder times like "need reminder at 4 and then 4.30".
3. Handles multiple reminder alerts for one event.
4. Keeps event time separate from reminder alert times.
5. Removes phrases like "but need reminder at..." from task title.
6. Retains before-event reminder support such as "half an hour before".
7. Keeps strict save validation.

Primary UAT:
- Team meeting at 5 PM Today but need reminder at 4 and then 4.30
Expected: Event 5:00 PM, reminders 4:00 PM and 4:30 PM, task title Team meeting.

- Lunch with X tomorrow, reminder at 12 and 1 as lunch is at 1.10
Expected: Event 1:10 PM, reminders 12:00 PM and 1:00 PM.
