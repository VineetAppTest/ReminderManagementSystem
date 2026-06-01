# RemindIQ 3N.10.1 Fullscreen Alarm Integration Instructions

## 1. Copy native Kotlin files

Copy:

```text
android/FullScreenAlarmActivity.kt
android/AlarmDueReceiver.kt
```

Into your Android native source folder:

```text
android/app/src/main/java/<your/package/path>/
```

Example if package is `com.remindiq.app`:

```text
android/app/src/main/java/com/remindiq/app/
```

Important:
- If your app package is not `com.remindiq.app`, update the package line at the top of both Kotlin files.

---

## 2. Copy layout/resource files

Copy:

```text
android/activity_full_screen_alarm.xml
```

To:

```text
android/app/src/main/res/layout/activity_full_screen_alarm.xml
```

Copy:

```text
android/remindiq_alarm_styles.xml
```

To:

```text
android/app/src/main/res/values/remindiq_alarm_styles.xml
```

Copy:

```text
android/remindiq_alarm_gradient.xml
```

To:

```text
android/app/src/main/res/drawable/remindiq_alarm_gradient.xml
```

Create missing folders if required.

---

## 3. Patch AndroidManifest.xml

Open:

```text
android/app/src/main/AndroidManifest.xml
```

Add these permissions above `<application>`:

```xml
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Inside `<application>`, add:

```xml
<activity
    android:name=".FullScreenAlarmActivity"
    android:exported="false"
    android:excludeFromRecents="true"
    android:launchMode="singleTask"
    android:showWhenLocked="true"
    android:turnScreenOn="true"
    android:theme="@style/AppTheme.NoActionBar" />

<receiver
    android:name=".AlarmDueReceiver"
    android:enabled="true"
    android:exported="false" />
```

If `@style/AppTheme.NoActionBar` does not exist, use your current MainActivity theme or create a no-actionbar theme.

---

## 4. Wire alarm scheduling

When a reminder is saved and has dueAt, the native scheduler must eventually send a broadcast to `AlarmDueReceiver`.

Intent extras required:

```kotlin
putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_ID, reminderId)
putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TITLE, reminderTitle)
putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TIME, reminderTime)
```

The receiver then launches `FullScreenAlarmActivity`.

If your existing native alarm code already schedules an AlarmManager PendingIntent, change its target from the old receiver/activity to:

```kotlin
AlarmDueReceiver::class.java
```

---

## 5. Add TypeScript bridge file

Copy:

```text
src/fullscreenAlarmBridge3N10_1.ts
```

Into:

```text
src/lib/fullscreenAlarmBridge3N10_1.ts
```

or your existing reminder scheduling module.

Use the rule:

```ts
shouldUseFullscreenAlarm3N10_1(payload)
```

before falling back to normal notification.

---

## 6. Update build label

Replace old labels:

```text
Sprint 3N.8 · P0 Single Native Alarm Surface
Sprint 3N.10 · P0 Parser + State Guard
3N.8-P0
3N.10-P0
```

With:

```text
Sprint 3N.10.1 · P0 Parser + Fullscreen Alarm
3N.10.1-P0
```

---

## 7. Critical Android notes

Fullscreen alarm behavior can still be affected by device/OEM settings:
- Battery optimization
- Background launch restrictions
- Notification permission
- Exact alarm permission
- Fullscreen intent permission/policy

Therefore the patch uses two routes:
1. Direct Activity launch.
2. Fullscreen high-priority notification fallback.

Both are needed.

---

## 8. Build commands

From project root:

```cmd
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then from Android Studio run the app, or:

```cmd
cd android
gradlew assembleDebug
```

---

## 9. Mandatory checks before calling it fixed

Do not mark this fixed unless:

1. Locked screen test passes.
2. Snooze button is visible.
3. Dismiss button is visible.
4. Open RemindIQ button is visible.
5. Future reminder does not appear under Reminded before firing.
6. Build label shows `3N.10.1-P0`.
