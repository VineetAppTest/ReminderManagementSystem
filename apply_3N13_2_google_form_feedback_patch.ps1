$ErrorActionPreference = "Stop"

Write-Host "Applying RemindIQ 3N.13.2 Google Forms Feedback Repository Patch..."

if (!(Test-Path "package.json")) {
  throw "Run this from the RemindIQ project root. Example: cd C:\Users\hp\ReminderManagementSystem-app"
}

$repoPath = "src/lib/feedbackRepository.ts"
if (!(Test-Path $repoPath)) {
  throw "Could not find $repoPath"
}

Copy-Item $repoPath "$repoPath.bak_3N13_2" -Force
Copy-Item "src/lib/feedbackRepository.ts" $repoPath -Force
Write-Host "Updated $repoPath"

$envPath = ".env"
if (Test-Path $envPath) {
  Copy-Item $envPath ".env.bak_3N13_2" -Force
}

$envLines = @(
  "VITE_FEEDBACK_PROVIDER=google_form",
  "VITE_GOOGLE_FORM_SUBMIT_URL=https://docs.google.com/forms/d/e/1FAIpQLSeHKye_kKR4TPv6zZ5sDjy7HaghBG6lqhU8ZmlI_KaA0i1tpA/formResponse",
  "VITE_GOOGLE_FORM_ENTRY_TESTER_ID=615800120",
  "VITE_GOOGLE_FORM_ENTRY_ISSUE_TYPE=2046109435",
  "VITE_GOOGLE_FORM_ENTRY_COMMENT=544153105",
  "VITE_GOOGLE_FORM_ENTRY_CONVERSATION=545535791",
  "VITE_GOOGLE_FORM_ENTRY_DRAFT=1691909702",
  "VITE_GOOGLE_FORM_ENTRY_REMINDERS=1142248890",
  "VITE_GOOGLE_FORM_ENTRY_APP_VERSION=373003847",
  "VITE_GOOGLE_FORM_ENTRY_BUILD_LABEL=2045062760",
  "VITE_GOOGLE_FORM_ENTRY_PLATFORM=864707228",
  "VITE_GOOGLE_FORM_ENTRY_USER_AGENT=502187853",
  "VITE_GOOGLE_FORM_ENTRY_CREATED_AT=1117355301"
)

$existing = ""
if (Test-Path $envPath) {
  $existing = Get-Content $envPath -Raw
}

foreach ($line in $envLines) {
  $key = ($line -split "=", 2)[0]
  if ($existing -match "(?m)^$key=") {
    $existing = [regex]::Replace($existing, "(?m)^$key=.*$", $line)
  } else {
    if ($existing.Length -gt 0 -and !$existing.EndsWith("`n")) { $existing += "`r`n" }
    $existing += "$line`r`n"
  }
}

Set-Content $envPath $existing
Write-Host "Updated .env with Google Form feedback repository config."

Write-Host ""
Write-Host "Patch applied."
Write-Host "Now run:"
Write-Host "cd C:\Users\hp\ReminderManagementSystem-app"
Write-Host "npm.cmd run build"
Write-Host "npx.cmd cap sync android"
Write-Host "npx.cmd cap open android"
