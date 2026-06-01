$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12.5 Native Wiring Patch..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root where package.json exists."
}

# 1. Ensure src/native helper exists.
New-Item -ItemType Directory -Force -Path "src/native" | Out-Null

$bridgePath = "src/native/nativeAlarmBridge3N12_5.ts"

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

# 2. Patch AndroidManifest.xml.
$manifestPath = "android/app/src/main/AndroidManifest.xml"
if (!(Test-Path $manifestPath)) {
  throw "AndroidManifest.xml not found at $manifestPath"
}

$manifestBackup = "$manifestPath.bak_3N12_5"
Copy-Item $manifestPath $manifestBackup -Force
Write-Host "Backup created: $manifestBackup"

$manifest = Get-Content $manifestPath -Raw

function Add-Permission($permissionName) {
  $script:manifest = Get-Content $script:manifestPath -Raw
  if ($script:manifest -notmatch [regex]::Escape($permissionName)) {
    $script:manifest = $script:manifest -replace '(<manifest[^>]*>)', "`$1`r`n    <uses-permission android:name=`"$permissionName`" />"
    Set-Content $script:manifestPath $script:manifest
    Write-Host "Added permission: $permissionName"
  } else {
    Write-Host "Permission already present: $permissionName"
  }
}

Add-Permission "android.permission.POST_NOTIFICATIONS"
Add-Permission "android.permission.SCHEDULE_EXACT_ALARM"
Add-Permission "android.permission.USE_FULL_SCREEN_INTENT"
Add-Permission "android.permission.VIBRATE"
Add-Permission "android.permission.WAKE_LOCK"
Add-Permission "android.permission.FOREGROUND_SERVICE"
Add-Permission "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"

$manifest = Get-Content $manifestPath -Raw

$declarations = @'

        <!-- RemindIQ 3N.12.5 Native Alarm Wiring -->
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
  Set-Content $manifestPath $manifest
  Write-Host "Added native alarm Activity/Receiver/Service declarations."
} else {
  Write-Host "Native alarm declarations appear to already exist."
}

# 3. Update build label if App.tsx exists.
$appPath = "src/App.tsx"
if (Test-Path $appPath) {
  $app = Get-Content $appPath -Raw
  $app = $app -replace '3N\.12-P0', '3N.12.5-P0'
  $app = $app -replace 'Sprint 3N\.12\s*·\s*P0 Native Alarm Spike', 'Sprint 3N.12.5 · P0 Native Wiring'
  Set-Content $appPath $app
  Write-Host "Updated App.tsx build label to 3N.12.5 if matching old labels were present."
}

Write-Host ""
Write-Host "Patch applied."
Write-Host ""
Write-Host "MANDATORY MANUAL STEP:"
Write-Host "Open src\App.tsx and call scheduleNativeReminderAlarm3N12_5(savedReminder) immediately after reminder save."
Write-Host ""
Write-Host "Then run:"
Write-Host "cd C:\Users\hp\ReminderManagementSystem-app"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "npx.cmd cap open android"
