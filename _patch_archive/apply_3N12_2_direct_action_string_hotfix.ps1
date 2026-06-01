$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12.2 Direct Native Action String Hotfix..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root where package.json exists."
}

$target = "android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java"

if (!(Test-Path $target)) {
  Write-Host "Did not find expected file path: $target"
  Write-Host "Searching under android/app/src/main/java..."
  $found = Get-ChildItem -Path "android/app/src/main/java" -Recurse -Filter "RemindIqNativeAlarmPlugin.java" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $found) {
    throw "Could not find RemindIqNativeAlarmPlugin.java"
  }
  $target = $found.FullName
}

Write-Host "Target file: $target"

$backup = "$target.bak_3N12_2"
Copy-Item $target $backup -Force
Write-Host "Backup created: $backup"

$content = Get-Content $target -Raw

$beforeFireCount = ([regex]::Matches($content, "\bACTION_FIRE_ALARM\b")).Count
$beforeStopCount = ([regex]::Matches($content, "\bACTION_STOP\b")).Count

$content = [regex]::Replace($content, "\bACTION_FIRE_ALARM\b", '"remindiq.action.FIRE_NATIVE_ALARM"')
$content = [regex]::Replace($content, "\bACTION_STOP\b", '"remindiq.action.STOP_NATIVE_ALARM"')

Set-Content $target $content

$after = Get-Content $target -Raw
$afterFireCount = ([regex]::Matches($after, "\bACTION_FIRE_ALARM\b")).Count
$afterStopCount = ([regex]::Matches($after, "\bACTION_STOP\b")).Count

Write-Host "ACTION_FIRE_ALARM replacements made: $beforeFireCount"
Write-Host "ACTION_STOP replacements made: $beforeStopCount"
Write-Host "Remaining ACTION_FIRE_ALARM bare references: $afterFireCount"
Write-Host "Remaining ACTION_STOP bare references: $afterStopCount"

if ($afterFireCount -gt 0 -or $afterStopCount -gt 0) {
  throw "Bare action variable references still remain. Open $target and replace them manually."
}

Write-Host ""
Write-Host "Patch applied."
Write-Host "Now run:"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "Then rebuild Android Studio."
