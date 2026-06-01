# RemindIQ 3N.12.4 Qualified Constant Reference Fix

## Issue fixed

Current build errors:

```text
cannot find symbol variable ACTION_FIRE_ALARM
cannot find symbol variable ACTION_STOP
```

## Actual root cause

`RemindIqNativeAlarmPlugin.java` already has these constants:

```java
private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";
```

But the file is not using them. It is calling:

```java
RemindIqAlarmReceiver.ACTION_FIRE_ALARM
RemindIqRingingService.ACTION_STOP
```

Those constants are not defined/exposed in those other classes.

## What this patch does

It updates `RemindIqNativeAlarmPlugin.java`:

```java
receiverIntent.setAction(RemindIqAlarmReceiver.ACTION_FIRE_ALARM);
```

to:

```java
receiverIntent.setAction(ACTION_FIRE_ALARM);
```

And:

```java
intent.setAction(RemindIqAlarmReceiver.ACTION_FIRE_ALARM);
```

to:

```java
intent.setAction(ACTION_FIRE_ALARM);
```

And:

```java
stopIntent.setAction(RemindIqRingingService.ACTION_STOP);
```

to:

```java
stopIntent.setAction(ACTION_STOP);
```

## Apply

From RemindIQ project root:

```cmd
powershell -ExecutionPolicy Bypass -File apply_3N12_4_qualified_constant_reference_fix.ps1
```

Then:

```cmd
npm.cmd run build
npx.cmd cap sync android
```

Then rebuild in Android Studio.
