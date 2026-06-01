# Manual Fix

Open:

```text
android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java
```

Find the line:

```java
public class RemindIqNativeAlarmPlugin ...
```

Immediately after the opening `{`, add:

```java
// RemindIQ 3N.12.1 build hotfix: action constants used by this plugin.
private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";
```

Then rebuild.
