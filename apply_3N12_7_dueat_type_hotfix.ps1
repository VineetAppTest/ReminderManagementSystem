$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12.7 dueAt TypeScript Hotfix..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root. Example: cd C:\Users\hp\ReminderManagementSystem-app"
}

$target = "src/native/nativeAlarmBridge3N12_5.ts"

if (!(Test-Path $target)) {
  throw "Could not find $target. Run the 3N.12.6 patch first, or confirm the native bridge file location."
}

$backup = "$target.bak_3N12_7"
Copy-Item $target $backup -Force
Write-Host "Backup created: $backup"

$content = Get-Content $target -Raw

# Widen dueAt type to accept null from Reminder.
$content = $content -replace 'dueAt\?: string;', 'dueAt?: string | null;'
$content = $content -replace 'dueAt\?: string;\r?\n\s*timeText\?: string;\r?\n\s*}\>;', 'dueAt?: string | null;`r`n    timeText?: string;`r`n  }>;'

# In case the alerts block is formatted differently, do a second focused replacement.
$content = $content -replace 'alerts\?: Array<\{\r?\n\s*dueAt\?: string;', 'alerts?: Array<{`r`n    dueAt?: string | null;'

Set-Content $target $content

$after = Get-Content $target -Raw

if ($after -notmatch 'dueAt\?: string \| null;') {
  throw "Could not confirm dueAt?: string | null; in $target"
}

Write-Host "Updated dueAt type to allow null."
Write-Host ""
Write-Host "Now run:"
Write-Host "cd C:\Users\hp\ReminderManagementSystem-app"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "npx.cmd cap open android"
