$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12.6 App Native Schedule Wiring Patch..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root where package.json exists. Example: cd C:\Users\hp\ReminderManagementSystem-app"
}

$appPath = "src/App.tsx"
if (!(Test-Path $appPath)) {
  throw "Could not find src/App.tsx"
}

$backup = "$appPath.bak_3N12_6"
Copy-Item $appPath $backup -Force
Write-Host "Backup created: $backup"

$app = Get-Content $appPath -Raw

# 1. Ensure import exists.
if ($app -notmatch 'scheduleNativeReminderAlarm3N12_5') {
  $app = $app -replace 'import \{ Capacitor, registerPlugin \} from "@capacitor/core";', 'import { Capacitor, registerPlugin } from "@capacitor/core";' + "`r`n" + 'import { scheduleNativeReminderAlarm3N12_5 } from "./native/nativeAlarmBridge3N12_5";'
  Write-Host "Added native schedule bridge import."
} else {
  Write-Host "Native schedule bridge import already exists."
}

# 2. Update build labels.
$app = [regex]::Replace($app, 'const APP_VERSION = ".*?";', 'const APP_VERSION = "3N.12.6-P0";', 1)
$app = [regex]::Replace($app, 'const APP_BUILD_LABEL = ".*?";', 'const APP_BUILD_LABEL = "Sprint 3N.12.6 · P0 Native Schedule Wired";', 1)
$app = [regex]::Replace($app, 'const \[alarmStatus, setAlarmStatus\] = useState\(".*?"\);', 'const [alarmStatus, setAlarmStatus] = useState("3N.12.6 native alarm wiring active.");', 1)

# 3. Force native-only alarm UI path for 3N.12.
$app = [regex]::Replace($app, 'const useNativeAlarmOnly\s*=\s*false\s*;', 'const useNativeAlarmOnly = true;', 1)

# 4. Replace scheduleNativeAlarm function.
$newFunction = @'
  async function scheduleNativeAlarm(reminder: Reminder) {
    if (!reminder.dueAt || reminder.status !== "confirmed") {
      setAlarmStatus(`Native alarm skipped for ${reminder.title}: missing due time or reminder not confirmed.`);
      return;
    }

    const when = new Date(reminder.dueAt);
    if (when.getTime() <= Date.now()) {
      setAlarmStatus(`Skipped past alarm for ${reminder.title}.`);
      return;
    }

    if (isAndroidNativeShell()) {
      try {
        setAlarmStatus(`Scheduling native alarm for ${reminder.title} at ${reminder.timeText}...`);

        try {
          await requestNativeAlarmPermissions();
        } catch {
          // Permission helper is best-effort. Native scheduler will still report capability/failure.
        }

        const result = await scheduleNativeReminderAlarm3N12_5(reminder);

        if (result?.skipped) {
          setAlarmStatus(`Native alarm not scheduled: ${result.reason || "unknown reason"}.`);
          setAlarmCapability(`Native schedule skipped: ${result.reason || "unknown reason"}`);
          return;
        }

        const scheduler = result?.usedAlarmClock ? "AlarmClock scheduler" : "native scheduler";
        setAlarmStatus(`Native alarm scheduled for ${reminder.dateText} at ${reminder.timeText}.`);
        setAlarmCapability(`${scheduler} · id ${reminder.id}`);

        try {
          await checkNativeAlarmDiagnostics();
        } catch {
          // Diagnostics are useful but should not block scheduling.
        }

        return;
      } catch (error: any) {
        const message = error?.message || String(error || "unknown error");
        setAlarmStatus(`Native alarm schedule failed for ${reminder.title}: ${message}`);
        setAlarmCapability(`Native schedule failed: ${message}`);
        console.error("[3N.12.6] Native alarm schedule failed", error);
        return;
      }
    }

    // Web/PWA fallback only.
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.abs(Array.from(reminder.id).reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 2147483647,
            title: "RemindIQ reminder",
            body: reminder.eventTimeText
              ? `${reminder.title} · reminder ${reminder.timeText} · event ${reminder.eventTimeText}`
              : `${reminder.title} · ${reminder.timeText}`,
            schedule: { at: when, allowWhileIdle: true },
            channelId: "remindiq_web_fallback",
            sound: "default",
            smallIcon: "ic_launcher",
            autoCancel: true,
            ongoing: false,
            extra: { reminderId: reminder.id },
          },
        ],
      });
      setAlarmStatus(`Web fallback notification scheduled for ${reminder.dateText} at ${reminder.timeText}.`);
    } catch {
      setAlarmStatus("Saved reminder. Web fallback notification could not be scheduled.");
    }
  }
'@

$pattern = '(?s)  async function scheduleNativeAlarm\(reminder: Reminder\) \{.*?\r?\n  \}\r?\n\r?\n  async function cancelNativeAlarm'
if ($app -notmatch $pattern) {
  throw "Could not find scheduleNativeAlarm function block to replace. Upload current App.tsx if this happens."
}

$app = [regex]::Replace($app, $pattern, $newFunction + "`r`n`r`n  async function cancelNativeAlarm", 1)

Set-Content $appPath $app
Write-Host "Updated src/App.tsx scheduleNativeAlarm wiring."

# 5. Ensure native bridge file exists.
New-Item -ItemType Directory -Force -Path "src/native" | Out-Null
$bridgePath = "src/native/nativeAlarmBridge3N12_5.ts"
if (!(Test-Path $bridgePath)) {
$bridgeContent = @'
import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeAlarmPlugin3N12_5 = {
  scheduleAlarm(payload: {
    id: string;
    title: string;
    body?: string;
    dueAt: string;
    timeText?: string;
    category?: string;
  }): Promise<any>;
  getAlarmCapability(): Promise<any>;
};

const RemindIqNativeAlarm = registerPlugin<NativeAlarmPlugin3N12_5>("RemindIqNativeAlarm");

export type ReminderLike3N12_5 = {
  id?: string;
  title?: string;
  task?: string;
  body?: string;
  rawText?: string;
  dueAt?: string;
  timeText?: string;
  eventTimeText?: string;
  category?: string;
  alerts?: Array<{
    dueAt?: string;
    timeText?: string;
  }>;
};

function resolveReminderId(reminder: ReminderLike3N12_5): string {
  return reminder.id || `remindiq_${Date.now()}`;
}

function resolveTitle(reminder: ReminderLike3N12_5): string {
  return (
    reminder.title ||
    reminder.task ||
    reminder.rawText ||
    "RemindIQ reminder"
  ).trim();
}

function resolveDueAt(reminder: ReminderLike3N12_5): string | null {
  return reminder.dueAt || reminder.alerts?.[0]?.dueAt || null;
}

function resolveTimeText(reminder: ReminderLike3N12_5): string {
  return reminder.timeText || reminder.alerts?.[0]?.timeText || "";
}

export async function scheduleNativeReminderAlarm3N12_5(
  reminder: ReminderLike3N12_5
): Promise<any> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[3N.12.5] Native alarm skipped because app is not running on native platform.");
    return { skipped: true, reason: "not_native_platform" };
  }

  const id = resolveReminderId(reminder);
  const title = resolveTitle(reminder);
  const dueAt = resolveDueAt(reminder);
  const timeText = resolveTimeText(reminder);
  const category = reminder.category || "General";

  if (!dueAt) {
    console.error("[3N.12.5] Native alarm not scheduled: missing dueAt", reminder);
    return { skipped: true, reason: "missing_dueAt" };
  }

  const payload = {
    id,
    title,
    body: reminder.body || `${title}${timeText ? ` · ${timeText}` : ""}`,
    dueAt,
    timeText,
    category,
  };

  console.log("[3N.12.5] Calling native scheduleAlarm", payload);

  const result = await RemindIqNativeAlarm.scheduleAlarm(payload);

  console.log("[3N.12.5] Native scheduleAlarm result", result);

  return result;
}

export async function getNativeAlarmCapability3N12_5(): Promise<any> {
  if (!Capacitor.isNativePlatform()) {
    return { skipped: true, reason: "not_native_platform" };
  }

  const result = await RemindIqNativeAlarm.getAlarmCapability();
  console.log("[3N.12.5] Native alarm capability", result);
  return result;
}
'@
  Set-Content $bridgePath $bridgeContent
  Write-Host "Created $bridgePath"
} else {
  Write-Host "$bridgePath already exists."
}

# 6. Patch AndroidManifest declarations if missing.
$manifestPath = "android/app/src/main/AndroidManifest.xml"
if (Test-Path $manifestPath) {
  $manifestBackup = "$manifestPath.bak_3N12_6"
  Copy-Item $manifestPath $manifestBackup -Force
  Write-Host "Manifest backup created: $manifestBackup"

  $manifest = Get-Content $manifestPath -Raw

  $permissions = @(
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.USE_FULL_SCREEN_INTENT",
    "android.permission.VIBRATE",
    "android.permission.WAKE_LOCK",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
  )

  foreach ($perm in $permissions) {
    if ($manifest -notmatch [regex]::Escape($perm)) {
      $manifest = $manifest -replace '(<manifest[^>]*>)', "`$1`r`n    <uses-permission android:name=`"$perm`" />"
      Write-Host "Added permission $perm"
    }
  }

  $declarations = @'

        <!-- RemindIQ 3N.12.6 Native Alarm Wiring -->
        <activity
            android:name=".RemindIqAlarmActivity"
            android:excludeFromRecents="true"
            android:exported="false"
            android:launchMode="singleTask"
            android:showWhenLocked="true"
            android:turnScreenOn="true" />

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
'@

  if ($manifest -notmatch 'RemindIqAlarmActivity') {
    $manifest = $manifest -replace '(</application>)', "$declarations`r`n    `$1"
    Write-Host "Added native alarm declarations."
  } else {
    Write-Host "Native alarm declarations already exist."
  }

  Set-Content $manifestPath $manifest
} else {
  Write-Host "Warning: AndroidManifest.xml not found at expected path."
}

Write-Host ""
Write-Host "Patch applied."
Write-Host "Now run:"
Write-Host "cd C:\Users\hp\ReminderManagementSystem-app"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "npx.cmd cap open android"
