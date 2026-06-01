$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.12-P0 Native Alarm Spike files..."

$projectRoot = Get-Location
$src = Join-Path $projectRoot "android/app/src/main/java/com/remindiq/app"

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root where package.json exists."
}

New-Item -ItemType Directory -Force -Path $src | Out-Null
New-Item -ItemType Directory -Force -Path "android/app/src/main/res/layout" | Out-Null
New-Item -ItemType Directory -Force -Path "android/app/src/main/res/drawable" | Out-Null
New-Item -ItemType Directory -Force -Path "src/native" | Out-Null

Copy-Item "android/app/src/main/java/com/remindiq/app/*.java" $src -Force
Copy-Item "android/app/src/main/res/layout/*.xml" "android/app/src/main/res/layout/" -Force
Copy-Item "android/app/src/main/res/drawable/*.xml" "android/app/src/main/res/drawable/" -Force
Copy-Item "src/native/*.ts" "src/native/" -Force

Write-Host "Native files copied."

# Update App.tsx labels if present.
$app = "src/App.tsx"
if (Test-Path $app) {
  $content = Get-Content $app -Raw
  $content = $content `
    -replace '3N\.\d+(?:\.\d+)?-P0', '3N.12-P0' `
    -replace 'Sprint 3N\.[^"]+', 'Sprint 3N.12 · P0 Native Alarm Spike'
  $content = $content -replace 'const useNativeAlarmOnly\s*=\s*false\s*;', 'const useNativeAlarmOnly = true;'
  Set-Content $app $content
  Write-Host "Updated App.tsx build label and native-only alarm flag."
}

Write-Host ""
Write-Host "IMPORTANT: register the plugin in MainActivity if not already registered:"
Write-Host "  registerPlugin(RemindIqNativeAlarm.class);"
Write-Host ""
Write-Host "Now run:"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host """%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"" uninstall com.remindiq.app"
