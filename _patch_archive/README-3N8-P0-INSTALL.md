# RemindIQ Sprint 3N.8 P0 — Single Native Alarm Surface Hotfix

## Purpose
This is a drop-in hotfix for the current 3N.8 folder.

It addresses the remaining lock-screen alarm issue where the old React/WebView full-screen overlay was still appearing as a white/intermediate screen and hiding Snooze/Done.

## Key change
The Android APK now forces native-only alarm handling. The React/WebView full-screen alarm overlay is suppressed for Android, so the native `RemindIqAlarmActivity` is the only alarm control surface.

## Install
1. Unzip this package.
2. Copy all contents into your current RemindIQ project folder.
3. Choose **Replace files in destination**.
4. Run:

```powershell
npm run build
npx cap sync android
npx cap open android
```

5. Rebuild and install from Android Studio.

## Confirm version
The app should show:

```text
Sprint 3N.8 · P0 Single Native Alarm Surface
```

## P0 test
1. Set alarm for 1 minute from now.
2. Lock the phone.
3. When alarm fires, the first and only visible screen should be the native dark RemindIQ alarm control screen.
4. Snooze 10 min and Done / Stop must be visible immediately.
5. There should be no white/intermediate screen.
6. There should be no second screen.
