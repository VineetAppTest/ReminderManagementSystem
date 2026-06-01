# RemindIQ 3N.11.2 Applied Wiring Patch

## What I found in the uploaded debug files

The previous 3N.11 files were present in the project, but they were not wired into the running app.

Evidence from `src/App.tsx`:
- Active app version was still:
  - `APP_VERSION = "3N.8-P0"`
  - `APP_BUILD_LABEL = "Sprint 3N.8 · P0 Single Native Alarm Surface"`
- The app still imported and rendered the old component:
  - `import FullScreenAlarm from "./components/FullScreenAlarm";`
- The old alarm overlay was explicitly disabled on Android:
  - `const useNativeAlarmOnly = true;`
- `FullScreenAlarm.tsx` also suppressed itself on Android:
  - `const suppressForNativeAndroid = isAndroidNativeAlarmShell();`

This is why the patch looked like it was not applied: the new files existed, but the active runtime path was still 3N.8/native-only.

## Why reminders disappeared from the Reminders tab

In `src/App.tsx`, the due-reminder timer did this when a reminder became due:

```ts
return {
  ...item,
  notifiedAt: new Date().toISOString(),
};
```

Then `visibleReminders()` in `reminderEngine.ts` hides/archives reminders when:
- status is `confirmed`
- dueAt is in the past
- notifiedAt exists

So the reminder could disappear before the user pressed Done/Dismiss.

## What this patch changes

### 1. Build label proves active patch

Updated:
- `APP_VERSION = "3N.11.2-P0"`
- `APP_BUILD_LABEL = "Sprint 3N.11.2 · P0 Applied Alarm Wiring"`

### 2. Re-enable WebView alarm surface

Changed:

```ts
const useNativeAlarmOnly = false;
```

This allows the in-app alarm control overlay to render on Android instead of relying only on the unreliable native fullscreen path.

### 3. Stop suppressing alarm controls on Android

Changed `FullScreenAlarm.tsx` so it no longer returns `null` on Android.

### 4. Do not mark notifiedAt on due detection

When reminder becomes due, this patch keeps the reminder as-is until the user presses Done/Dismiss.

This prevents premature hiding from the Reminders tab.

### 5. Snooze default adjusted

Changed visible alarm control from 10 minutes to 5 minutes.

## Files replaced

Copy these over the existing files:

```text
src/App.tsx
src/components/FullScreenAlarm.tsx
```

## Mandatory commands after applying

From project root:

```cmd
npm.cmd run build
npx.cmd cap sync android
```

Then uninstall the old app before installing/running the new build:

```cmd
adb uninstall com.remindiq.app
```

Then run/install again from Android Studio or:

```cmd
cd android
gradlew assembleDebug
```

## Acceptance checks

1. App must show `3N.11.2-P0`, not `3N.8-P0`.
2. Create reminder for 1 minute from now.
3. Confirm save.
4. Reminder must appear in Reminders tab before alarm fires.
5. When alarm fires, the full RemindIQ in-app alarm control surface must appear.
6. Snooze button must be visible.
7. Done / Stop button must be visible.
8. After Done, the reminder should remain visible under Done, not disappear completely.
