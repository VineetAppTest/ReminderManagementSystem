# Sprint 3N.8 Notes

## Name
RemindIQ 3N.8 — Single Alarm UI + Fresh State Reset

## P0 fixes
- One-screen alarm rule restored.
- Android native alarm activity is the only alarm control UI in APK.
- React/web overlay is disabled for Android native shell to avoid duplicate/white screen.
- MiniViktor stale speech state is cleared on build update and app start.

## Validation
Web build passed via `npm run build` in the available source environment. Android compile/install must be validated on the user's machine with Android Studio/Gradle.
