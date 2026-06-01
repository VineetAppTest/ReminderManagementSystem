# RemindIQ 3N.12.1 Native Constants Build Hotfix

## Build error fixed

Android Studio shows:

```text
RemindIqNativeAlarmPlugin.java
cannot find symbol variable ACTION_FIRE_ALARM
cannot find symbol variable ACTION_FIRE_ALARM
cannot find symbol variable ACTION_STOP
```

## Root cause

`RemindIqNativeAlarmPlugin.java` is using these constants but they are not declared in that Java class:

```java
ACTION_FIRE_ALARM
ACTION_STOP
```

## What this patch does

The script finds:

```text
android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java
```

and inserts these constants inside the class if missing:

```java
private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";
```

This is a compile hotfix only. It does not change the 3N.12 native alarm architecture.

## Apply

From the RemindIQ project root, run:

```cmd
powershell -ExecutionPolicy Bypass -File apply_3N12_1_native_constants_hotfix.ps1
```

Then run:

```cmd
npm.cmd run build
npx.cmd cap sync android
```

Then rebuild in Android Studio.
