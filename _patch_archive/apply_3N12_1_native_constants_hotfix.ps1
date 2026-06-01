$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12.1 Native Constants Build Hotfix..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root where package.json exists."
}

$target = "android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java"

if (!(Test-Path $target)) {
  Write-Host "Did not find $target"
  Write-Host "Searching for RemindIqNativeAlarmPlugin.java..."
  $found = Get-ChildItem -Path "android/app/src/main/java" -Recurse -Filter "RemindIqNativeAlarmPlugin.java" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $found) {
    throw "Could not find RemindIqNativeAlarmPlugin.java under android/app/src/main/java"
  }
  $target = $found.FullName
}

Write-Host "Patching $target"

$content = Get-Content $target -Raw

if ($content -match "ACTION_FIRE_ALARM" -and $content -match "private static final String ACTION_FIRE_ALARM") {
  Write-Host "ACTION_FIRE_ALARM constant already exists."
} else {
  $insert = @"

    // RemindIQ 3N.12.1 build hotfix: action constants used by this plugin.
    private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
    private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";

"@

  # Insert immediately after the first class declaration opening brace.
  $pattern = "(public\s+class\s+RemindIqNativeAlarmPlugin[^{]*\{)"
  if ($content -match $pattern) {
    $content = [regex]::Replace($content, $pattern, "`$1$insert", 1)
  } else {
    throw "Could not locate class declaration for RemindIqNativeAlarmPlugin."
  }

  Set-Content $target $content
  Write-Host "Inserted ACTION_FIRE_ALARM and ACTION_STOP constants."
}

Write-Host ""
Write-Host "Now run:"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "Then rebuild Android."
