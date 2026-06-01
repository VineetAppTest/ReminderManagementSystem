# AndroidManifest.xml patch for 3N.12-P0 Native Alarm Spike

Ensure these permissions exist above `<application>`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
```

Ensure these exist inside `<application>`:

```xml
<activity
    android:name=".RemindIqAlarmActivity"
    android:excludeFromRecents="true"
    android:exported="false"
    android:launchMode="singleTask"
    android:showWhenLocked="true"
    android:turnScreenOn="true"
    android:theme="@style/AppTheme.NoActionBarLaunch" />

<receiver
    android:name=".RemindIqAlarmReceiver"
    android:enabled="true"
    android:exported="false" />

<receiver
    android:name=".RemindIqAlarmActionReceiver"
    android:enabled="true"
    android:exported="false" />

<service
    android:name=".RemindIqRingingService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="mediaPlayback" />
```

Your uploaded manifest already had these declarations, so this spike reuses the same names.
