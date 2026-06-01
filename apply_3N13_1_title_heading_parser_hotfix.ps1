$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.13.1 Title / Heading Parser Hotfix..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root. Example: cd C:\Users\hp\ReminderManagementSystem-app"
}

$target = "src/lib/reminderEngine.ts"
$source = "src/lib/reminderEngine.ts"

if (!(Test-Path $target)) {
  throw "Could not find target file: $target"
}

# This script is mainly for verification when the ZIP is extracted over the project.
# If this script is inside the root after extraction, the file has already been overwritten.
Write-Host "Target present: $target"

$content = Get-Content $target -Raw

if ($content -notmatch "extractExplicitTitleFromInput") {
  throw "Patch not applied correctly. src/lib/reminderEngine.ts does not contain extractExplicitTitleFromInput."
}

if ($content -notmatch "with title") {
  Write-Host "Warning: Could not find with-title marker in file, but helper exists."
}

Write-Host "3N.13.1 parser hotfix appears applied."
Write-Host ""
Write-Host "Now run:"
Write-Host "cd C:\Users\hp\ReminderManagementSystem-app"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "npx.cmd cap open android"
