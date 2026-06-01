# Diagnosis Summary

The issue is not that 3N.11 files were absent. They were present.

The issue is that the active app flow was still using 3N.8 behavior.

Key blockers:
1. Build constants still said 3N.8.
2. Android path was forced to native-only via `useNativeAlarmOnly = true`.
3. `FullScreenAlarm.tsx` suppressed itself on Android.
4. Due reminders were being stamped with `notifiedAt` before user action, causing `visibleReminders()` to hide/archive them.
5. The new `AlarmSurface3N11.tsx` was present but not imported by `App.tsx`, so it was unused.
6. `AlarmSurface3N11.tsx` imports `./reminderStore3N11`, but in the uploaded structure the store is under `src/lib/reminderStore3N11.ts`; if wired directly, that import path would fail unless corrected.

Immediate recovery path:
- Apply this 3N.11.2 wiring patch first.
- Confirm version label changes.
- Confirm the old native-only path is no longer the only alarm path.
