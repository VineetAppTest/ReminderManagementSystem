$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.13.3 Apps Script Webhook no-cors Patch..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root. Example: cd C:\Users\hp\ReminderManagementSystem-app"
}

$target = "src/lib/feedbackRepository.ts"

if (!(Test-Path $target)) {
  throw "Could not find $target"
}

$backup = "$target.bak_3N13_3"
Copy-Item $target $backup -Force
Write-Host "Backup created: $backup"

$content = Get-Content $target -Raw

# Replace the whole pushToWebhook function if present.
$replacement = @'
async function pushToWebhook(config: RemoteFeedbackConfig, payload: any): Promise<FeedbackPushResult> {
  if (!config.endpoint) {
    return { ok: false, error: "Webhook endpoint missing." };
  }

  try {
    /*
     * RemindIQ 3N.13.3
     * Google Apps Script web apps often do not return a CORS-readable response
     * to Android WebView. Use no-cors + text/plain to avoid preflight and treat
     * dispatch as success. The Google Sheet row is the source of truth.
     */
    await fetch(config.endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Webhook submission failed.",
    };
  }
}
'@

$pattern = '(?s)async function pushToWebhook\(config: RemoteFeedbackConfig, payload: any\): Promise<FeedbackPushResult> \{.*?\n\}\s*\n\nexport async function pushFeedbackToRepository'

if ($content -match $pattern) {
  $content = [regex]::Replace($content, $pattern, $replacement + "`r`n`r`nexport async function pushFeedbackToRepository", 1)
  Write-Host "Replaced pushToWebhook with Apps Script no-cors version."
} else {
  throw "Could not find pushToWebhook function block. Upload src/lib/feedbackRepository.ts if this fails."
}

# Remove outdated Firebase diagnostic hint from App.tsx if present.
$appPath = "src/App.tsx"
if (Test-Path $appPath) {
  $app = Get-Content $appPath -Raw
  $appBackup = "$appPath.bak_3N13_3"
  Copy-Item $appPath $appBackup -Force

  $app = $app -replace '<small>Firebase needs VITE_FEEDBACK_PROVIDER=firebase, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_API_KEY in \.env\.</small>', '<small>Webhook mode uses VITE_FEEDBACK_PROVIDER=webhook and VITE_FEEDBACK_WEBHOOK_URL in .env.</small>'
  Set-Content $appPath $app
  Write-Host "Updated outdated Firebase hint in App.tsx if present."
}

Set-Content $target $content

Write-Host ""
Write-Host "Patch applied."
Write-Host "Now run:"
Write-Host "cd C:\Users\hp\ReminderManagementSystem-app"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "npx.cmd cap open android"
