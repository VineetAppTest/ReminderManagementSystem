# Manual Fix

Open:

```text
android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java
```

## 1. Fix lines around 28 and 29

If you see anything like:

```java
private static final String "remindiq.action.FIRE_NATIVE_ALARM" = ...
private static final String "remindiq.action.STOP_NATIVE_ALARM" = ...
```

delete those lines.

Then immediately after:

```java
public class RemindIqNativeAlarmPlugin extends Plugin {
```

add:

```java
private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";
```

## 2. Fix line around 73

If you see:

```java
""remindiq.action.FIRE_NATIVE_ALARM""
```

change it to:

```java
ACTION_FIRE_ALARM
```

If you see:

```java
""remindiq.action.STOP_NATIVE_ALARM""
```

change it to:

```java
ACTION_STOP
```

## 3. Rebuild

```cmd
npm.cmd run build
npx.cmd cap sync android
```
