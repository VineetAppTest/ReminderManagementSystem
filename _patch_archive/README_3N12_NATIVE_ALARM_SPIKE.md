# RemindIQ 3N.12-P0 Native Alarm Spike

## Decision

We are resetting the alarm architecture.

React/WebView:
- captures reminder
- saves reminder
- calls native schedule

Native Android:
- schedules alarm
- wakes/rings
- plays sound/vibrates
- shows one native alarm screen
- owns Snooze/Dismiss

## What this patch includes

Native Android Java files:

```text
android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarm.java
android/app/src/main/java/com/remindiq/app/RemindIqAlarmReceiver.java
android/app/src/main/java/com/remindiq/app/RemindIqAlarmActionReceiver.java
android/app/src/main/java/com/remindiq/app/RemindIqRingingService.java
android/app/src/main/java/com/remindiq/app/RemindIqAlarmActivity.java
```

Native resources:

```text
android/app/src/main/res/layout/activity_remindiq_alarm.xml
android/app/src/main/res/drawable/remindiq_native_alarm_bg.xml
android/app/src/main/res/drawable/remindiq_native_alarm_pill.xml
android/app/src/main/res/drawable/remindiq_native_alarm_blue_button.xml
android/app/src/main/res/drawable/remindiq_native_alarm_white_button.xml
android/app/src/main/res/drawable/remindiq_native_alarm_ghost_button.xml
```

React bridge helper:

```text
src/native/nativeAlarmSpike3N12.ts
```

## Critical step: register plugin in MainActivity

Open your MainActivity file. It is usually one of:

```text
android/app/src/main/java/com/remindiq/app/MainActivity.java
android/app/src/main/java/com/remindiq/app/MainActivity.kt
```

If Java:

```java
package com.remindiq.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RemindIqNativeAlarm.class);
        super.onCreate(savedInstanceState);
    }
}
```

If Kotlin:

```kotlin
package com.remindiq.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(RemindIqNativeAlarm::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

Without this, React may say the plugin is not available.

## App.tsx wiring

In `src/App.tsx`, keep:

```ts
const RemindIqNativeAlarm = registerPlugin<any>("RemindIqNativeAlarm");
```

Set build labels to:

```ts
const APP_VERSION = "3N.12-P0";
const APP_BUILD_LABEL = "Sprint 3N.12 · P0 Native Alarm Spike";
```

For the spike, keep the WebView alarm overlay disabled:

```ts
const useNativeAlarmOnly = true;
```

In `scheduleNativeAlarm(reminder)`, the native call should be the main path:

```ts
await RemindIqNativeAlarm.scheduleAlarm({
  id: reminder.id,
  title: reminder.title,
  body: reminder.eventTimeText
    ? `${reminder.title} · reminder ${reminder.timeText} · event ${reminder.eventTimeText}`
    : `${reminder.title} · ${reminder.timeText}`,
  dueAt: reminder.dueAt,
  timeText: reminder.timeText,
  category: reminder.category || "General",
});
```

Do not show the WebView alarm surface for this spike.

## Apply

Extract this ZIP into the RemindIQ project root and allow overwrite.

Then run:

```cmd
npm.cmd run build
npx.cmd cap sync android
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" uninstall com.remindiq.app
```

Then reinstall/run from Android Studio.

## Test

Test only this narrow scenario first:

```text
set a reminder for 1 minute from now
testing alarm
yes
```

Then:
1. Confirm reminder is saved under Reminders tab.
2. Lock phone.
3. Wait for due time.
4. Native alarm should ring with sound/vibration.
5. Native screen should show:
   - REMINDER DUE
   - title
   - time
   - Snooze 5m
   - Dismiss
   - Open RemindIQ

## Definition of Done for 3N.12-P0

- App closed: alarm rings.
- App backgrounded: alarm rings.
- Screen locked: native activity or fullscreen alarm notification appears.
- Sound/vibration works.
- Snooze works.
- Dismiss stops ringing.
- Only one alarm surface appears.
- WebView alarm screen is not part of ringing path.
