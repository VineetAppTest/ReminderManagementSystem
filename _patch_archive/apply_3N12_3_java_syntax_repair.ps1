$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12.3 Java Syntax Repair Hotfix..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root where package.json exists."
}

$target = "android/app/src/main/java/com/remindiq/app/RemindIqNativeAlarmPlugin.java"

if (!(Test-Path $target)) {
  Write-Host "Did not find expected file: $target"
  $found = Get-ChildItem -Path "android/app/src/main/java" -Recurse -Filter "RemindIqNativeAlarmPlugin.java" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $found) {
    throw "Could not find RemindIqNativeAlarmPlugin.java"
  }
  $target = $found.FullName
}

Write-Host "Repairing: $target"

$backup = "$target.bak_3N12_3"
Copy-Item $target $backup -Force
Write-Host "Backup created: $backup"

$content = Get-Content $target -Raw

# 1. Fix double-quoted malformed string literals.
$content = $content -replace '""remindiq\.action\.FIRE_NATIVE_ALARM""', '"remindiq.action.FIRE_NATIVE_ALARM"'
$content = $content -replace '""remindiq\.action\.STOP_NATIVE_ALARM""', '"remindiq.action.STOP_NATIVE_ALARM"'

# 2. Remove malformed declarations caused by replacing identifier names inside declarations.
# Example bad line:
# private static final String "remindiq.action.FIRE_NATIVE_ALARM" = "remindiq.action.FIRE_NATIVE_ALARM";
$lines = $content -split "`r?`n"
$cleanLines = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
  if ($line -match 'private\s+static\s+final\s+String\s+"remindiq\.action\.FIRE_NATIVE_ALARM"') {
    Write-Host "Removed malformed FIRE declaration: $line"
    continue
  }
  if ($line -match 'private\s+static\s+final\s+String\s+"remindiq\.action\.STOP_NATIVE_ALARM"') {
    Write-Host "Removed malformed STOP declaration: $line"
    continue
  }
  $cleanLines.Add($line)
}

$content = $cleanLines -join "`r`n"

# 3. Remove duplicate valid declarations if any; we will insert one clean set.
$content = [regex]::Replace($content, '^\s*private\s+static\s+final\s+String\s+ACTION_FIRE_ALARM\s*=\s*"remindiq\.action\.FIRE_NATIVE_ALARM";\s*$', '', 'Multiline')
$content = [regex]::Replace($content, '^\s*private\s+static\s+final\s+String\s+ACTION_STOP\s*=\s*"remindiq\.action\.STOP_NATIVE_ALARM";\s*$', '', 'Multiline')

# 4. Convert direct string usages back to constants.
$content = $content -replace '"remindiq\.action\.FIRE_NATIVE_ALARM"', 'ACTION_FIRE_ALARM'
$content = $content -replace '"remindiq\.action\.STOP_NATIVE_ALARM"', 'ACTION_STOP'

# 5. Insert clean constants just inside the class declaration.
$constants = @"

    // RemindIQ 3N.12.3 syntax repair: native action constants.
    private static final String ACTION_FIRE_ALARM = "remindiq.action.FIRE_NATIVE_ALARM";
    private static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";

"@

$pattern = '(public\s+class\s+RemindIqNativeAlarmPlugin[^{]*\{)'
if ($content -match $pattern) {
  $content = [regex]::Replace($content, $pattern, "`$1$constants", 1)
} else {
  throw "Could not locate class declaration in RemindIqNativeAlarmPlugin.java"
}

# 6. Clean excessive blank lines.
$content = [regex]::Replace($content, "(\r?\n){4,}", "`r`n`r`n`r`n")

Set-Content $target $content

Write-Host ""
Write-Host "Repair complete. Checking for common malformed patterns..."

$after = Get-Content $target -Raw

if ($after -match 'private\s+static\s+final\s+String\s+"remindiq\.action') {
  throw "Malformed quoted constant declaration still remains."
}

if ($after -match '""remindiq\.action') {
  throw "Double-quoted action string still remains."
}

if ($after -notmatch 'private\s+static\s+final\s+String\s+ACTION_FIRE_ALARM\s*=\s*"remindiq\.action\.FIRE_NATIVE_ALARM";') {
  throw "ACTION_FIRE_ALARM constant was not inserted correctly."
}

if ($after -notmatch 'private\s+static\s+final\s+String\s+ACTION_STOP\s*=\s*"remindiq\.action\.STOP_NATIVE_ALARM";') {
  throw "ACTION_STOP constant was not inserted correctly."
}

Write-Host "Syntax repair passed basic checks."
Write-Host ""
Write-Host "Now run:"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "Then rebuild Android Studio."
