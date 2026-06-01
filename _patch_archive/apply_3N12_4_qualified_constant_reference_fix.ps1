$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12.4 Qualified Constant Reference Fix..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root where package.json exists."
}

$target = "android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java"

if (!(Test-Path $target)) {
  $found = Get-ChildItem -Path "android/app/src/main/java" -Recurse -Filter "RemindIqNativeAlarmPlugin.java" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $found) {
    throw "Could not find RemindIqNativeAlarmPlugin.java"
  }
  $target = $found.FullName
}

Write-Host "Target file: $target"

$backup = "$target.bak_3N12_4"
Copy-Item $target $backup -Force
Write-Host "Backup created: $backup"

$content = Get-Content $target -Raw

# Ensure local constants exist.
if ($content -notmatch 'private\s+static\s+final\s+String\s+ACTION_FIRE_ALARM\s*=\s*"remindiq\.action\.FIRE_NATIVE_ALARM";') {
  $pattern = '(public\s+class\s+RemindIqNativeAlarmPlugin[^{]*\{)'
  $insert = @"

    private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
    private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";

"@
  $content = [regex]::Replace($content, $pattern, "`$1$insert", 1)
}

# Replace qualified references that point to classes where the constants are missing.
$content = $content -replace 'RemindIqAlarmReceiver\.ACTION_FIRE_ALARM', 'ACTION_FIRE_ALARM'
$content = $content -replace 'RemindIqRingingService\.ACTION_STOP', 'ACTION_STOP'

# Optional cleanup of repeated old comments.
$content = $content -replace '(\s*// RemindIQ 3N\.12\.3 syntax repair: native action constants\.\s*){2,}', "`r`n    // RemindIQ 3N.12.4: local native action constants.`r`n"

Set-Content $target $content

$after = Get-Content $target -Raw

if ($after -match 'RemindIqAlarmReceiver\.ACTION_FIRE_ALARM') {
  throw "Still found RemindIqAlarmReceiver.ACTION_FIRE_ALARM. Replacement failed."
}
if ($after -match 'RemindIqRingingService\.ACTION_STOP') {
  throw "Still found RemindIqRingingService.ACTION_STOP. Replacement failed."
}

Write-Host ""
Write-Host "Patch applied."
Write-Host "Now run:"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "Then rebuild Android Studio."
