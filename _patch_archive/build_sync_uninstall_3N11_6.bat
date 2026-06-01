@echo off
echo Building and syncing RemindIQ 3N.11.6...
npm.cmd run build
if errorlevel 1 exit /b %errorlevel%
npx.cmd cap sync android
if errorlevel 1 exit /b %errorlevel%
echo Attempting uninstall using full adb path...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" uninstall com.remindiq.app
echo If uninstall failed, uninstall RemindIQ manually from phone Settings > Apps.
