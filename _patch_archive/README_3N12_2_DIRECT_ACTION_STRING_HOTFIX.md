# RemindIQ 3N.12.2 Direct Native Action String Hotfix

## Issue fixed

Android build still fails with:

```text
RemindIqNativeAlarmPlugin.java
cannot find symbol variable ACTION_FIRE_ALARM
cannot find symbol variable ACTION_FIRE_ALARM
cannot find symbol variable ACTION_STOP
```

## Why 3N.12.1 did not clear it

3N.12.1 attempted to insert missing constants. Since Android Studio still shows the same error, the active Java file was either:
- not patched,
- patched in the wrong location,
- or the inserted constants are outside the class scope.

## 3N.12.2 approach

This patch removes the dependency on constants completely.

It directly replaces:

```java
ACTION_FIRE_ALARM
```

with:

```java
"remindiq.action.FIRE_NATIVE_ALARM"
```

And replaces:

```java
ACTION_STOP
```

with:

```java
"remindiq.action.STOP_NATIVE_ALARM"
```

inside:

```text
android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java
```

This should clear the `cannot find symbol variable` errors.

## Apply

From RemindIQ project root, where `package.json` exists:

```cmd
powershell -ExecutionPolicy Bypass -File apply_3N12_2_direct_action_string_hotfix.ps1
```

Then run:

```cmd
npm.cmd run build
npx.cmd cap sync android
```

Then rebuild in Android Studio.

## Verification

After applying, run:

```cmd
findstr /S /I "ACTION_FIRE_ALARM ACTION_STOP remindiq.action.FIRE_NATIVE_ALARM remindiq.action.STOP_NATIVE_ALARM" android\app\src\main\java\*
```

Expected:
- `ACTION_FIRE_ALARM` should not appear.
- `ACTION_STOP` should not appear as a bare variable.
- The string values should appear.
