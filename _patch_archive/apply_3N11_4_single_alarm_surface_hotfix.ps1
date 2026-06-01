$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.11.4 Single Alarm Surface Hotfix..."

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup_3N11_4_$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Backup-File($path) {
  if (Test-Path $path) {
    $target = Join-Path $backupDir ($path -replace '[\\/]', '_')
    Copy-Item $path $target -Force
    Write-Host "Backed up $path -> $target"
  }
}

# 1. Update build labels in App.tsx and any common TS/TSX files.
$files = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx,*.js,*.jsx,*.css -ErrorAction SilentlyContinue

foreach ($file in $files) {
  $content = Get-Content $file.FullName -Raw

  $newContent = $content `
    -replace 'Sprint 3N\.8\s*·\s*P0 Single Native Alarm Surface', 'Sprint 3N.11.4 · P0 Single Alarm Surface' `
    -replace 'Sprint 3N\.10\s*·\s*P0 Parser \+ State Guard', 'Sprint 3N.11.4 · P0 Single Alarm Surface' `
    -replace 'Sprint 3N\.11\s*·\s*P0 Alarm Recovery', 'Sprint 3N.11.4 · P0 Single Alarm Surface' `
    -replace 'Sprint 3N\.11\.2\s*P0 Applied Alarm Wiring', 'Sprint 3N.11.4 · P0 Single Alarm Surface' `
    -replace 'Sprint 3N\.11\.2\s*·\s*P0 Applied Alarm Wiring', 'Sprint 3N.11.4 · P0 Single Alarm Surface' `
    -replace '3N\.8-P0', '3N.11.4-P0' `
    -replace '3N\.10-P0', '3N.11.4-P0' `
    -replace '3N\.11-P0', '3N.11.4-P0' `
    -replace '3N\.11\.2-P0', '3N.11.4-P0'

  if ($newContent -ne $content) {
    Backup-File $file.FullName
    Set-Content $file.FullName $newContent
    Write-Host "Updated build labels in $($file.FullName)"
  }
}

# 2. CSS kill-switch for the broken first alarm surface.
# The broken screen uses the 3N.11 AlarmSurface classes and the ALARM RINGING pill.
$cssTarget = $null
if (Test-Path "src/App.css") {
  $cssTarget = "src/App.css"
} elseif (Test-Path "src/index.css") {
  $cssTarget = "src/index.css"
} else {
  $cssTarget = "src/App.css"
  New-Item -ItemType File -Force -Path $cssTarget | Out-Null
}

Backup-File $cssTarget
$css = Get-Content $cssTarget -Raw

$killSwitch = @"

/* RemindIQ 3N.11.4
   Kill duplicate broken first alarm surface.
   Keep the existing REMINDER DUE control card as the single alarm UI. */
.ri-alarm-page,
.ri-alarm-page[role="dialog"],
.ri-alarm-bg-pulse {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

"@

if ($css -notmatch "RemindIQ 3N\.11\.4[\s\S]*Kill duplicate broken first alarm surface") {
  Add-Content -Path $cssTarget -Value $killSwitch
  Write-Host "Added duplicate alarm surface kill-switch to $cssTarget"
} else {
  Write-Host "3N.11.4 kill-switch already present in $cssTarget"
}

# 3. If alarmSurface3N11.css exists, hard-disable it too.
$alarmCss = "src/components/alarmSurface3N11.css"
if (Test-Path $alarmCss) {
  Backup-File $alarmCss
  $alarmCssContent = Get-Content $alarmCss -Raw
  $disableCss = @"

/* RemindIQ 3N.11.4: disabled because this was rendering the broken first white ALARM RINGING surface. */
.ri-alarm-page,
.ri-alarm-page[role="dialog"],
.ri-alarm-bg-pulse {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

"@
  if ($alarmCssContent -notmatch "3N\.11\.4: disabled") {
    Set-Content $alarmCss ($disableCss + "`n" + $alarmCssContent)
    Write-Host "Disabled broken AlarmSurface3N11 CSS in $alarmCss"
  }
}

# 4. Report remaining references.
Write-Host ""
Write-Host "Remaining alarm references for review:"
Write-Host "--------------------------------------"

$patterns = @("ALARM RINGING", "AlarmSurface3N11", "REMINDER DUE", "FullScreenAlarm")
foreach ($pattern in $patterns) {
  Write-Host ""
  Write-Host "Searching: $pattern"
  Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx,*.js,*.jsx,*.css -ErrorAction SilentlyContinue |
    Select-String -Pattern $pattern -SimpleMatch |
    ForEach-Object {
      Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())"
    }
}

Write-Host ""
Write-Host "Patch applied."
Write-Host "Now run:"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "adb uninstall com.remindiq.app"
