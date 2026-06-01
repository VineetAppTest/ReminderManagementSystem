# RemindIQ 3N.13.2 Google Forms Feedback Repository Patch

## Purpose

Connect RemindIQ feedback capture to your Google Form / Google Sheet repository so manual feedback export/push is no longer needed.

## Apply steps

From PowerShell:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
powershell -ExecutionPolicy Bypass -File apply_3N13_2_google_form_feedback_patch.ps1
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then run from Android Studio.

## Test

1. Open RemindIQ.
2. Go to Feedback.
3. Report a test issue.
4. Open the linked Google Sheet.
5. Confirm a new row appears.

## Important

Google Forms submission uses `fetch(..., mode: "no-cors")`. The app cannot read a success response from Google Forms, but the row should appear in the linked Sheet if the request is sent and the device has internet.
