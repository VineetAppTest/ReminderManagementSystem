# RemindIQ 3N.12.3 Java Syntax Repair Hotfix

## Build errors fixed

Android Studio now shows:

```text
RemindIqNativeAlarmPlugin.java
<identifier> expected :28
<identifier> expected :29
string templates are a preview feature and are disabled by default :73
```

## Root cause

3N.12.2 directly replaced `ACTION_FIRE_ALARM` / `ACTION_STOP` with quoted strings.

That can break Java if the replacement touched a declaration line, creating invalid code such as:

```java
private static final String "remindiq.action.FIRE_NATIVE_ALARM" = "...";
```

or double quoted strings such as:

```java
""remindiq.action.FIRE_NATIVE_ALARM""
```

## What 3N.12.3 does

This script repairs `RemindIqNativeAlarmPlugin.java` by:

1. Removing malformed action-string declarations.
2. Fixing double-quoted action strings.
3. Reintroducing proper constants:

```java
private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";
```

4. Converting string literal usages back to proper constants where safe.

## Apply

From the RemindIQ project root:

```cmd
powershell -ExecutionPolicy Bypass -File apply_3N12_3_java_syntax_repair.ps1
```

Then run:

```cmd
npm.cmd run build
npx.cmd cap sync android
```

Then rebuild in Android Studio.
