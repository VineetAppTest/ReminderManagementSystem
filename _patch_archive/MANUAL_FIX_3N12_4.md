# Manual Fix

Open:

```text
android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java
```

Use Ctrl+H.

Replace all:

```java
RemindIqAlarmReceiver.ACTION_FIRE_ALARM
```

with:

```java
ACTION_FIRE_ALARM
```

Replace all:

```java
RemindIqRingingService.ACTION_STOP
```

with:

```java
ACTION_STOP
```

Make sure these constants exist near the top of the class:

```java
private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";
```

Then rebuild.
