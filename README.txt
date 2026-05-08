RemindIQ Sprint 2A Fix 3 - Time Context Loop Fix

Replace these files in your project.

Fixes:
- Breaks AM/PM confirmation loop.
- Understands explicit AM/PM replies like "4 AM" and "4:00 AM".
- Uses event context: if meeting is at 5 PM and user says "4ish", RemindIQ treats it as around 4:00 PM.
- Keeps Sprint 2A compact mobile persistence and filter layout.

Test flow:
Team Meeting at 5 pm
Today
4ish

Expected: confirms around 4:00 PM, not repeated AM/PM loop.
