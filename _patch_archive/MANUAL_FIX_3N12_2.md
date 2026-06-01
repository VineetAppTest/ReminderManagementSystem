# Manual Fix

Open:

```text
android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java
```

Use Ctrl+H.

Replace all:

```java
ACTION_FIRE_ALARM
```

with:

```java
"remindiq.action.FIRE_NATIVE_ALARM"
```

Replace all:

```java
ACTION_STOP
```

with:

```java
"remindiq.action.STOP_NATIVE_ALARM"
```

Then rebuild.

Important:
Do not replace occurrences that are already inside quotes if you manually added them earlier.
If you accidentally get double quotes like:

```java
""remindiq.action.FIRE_NATIVE_ALARM""
```

fix it to:

```java
"remindiq.action.FIRE_NATIVE_ALARM"
```
