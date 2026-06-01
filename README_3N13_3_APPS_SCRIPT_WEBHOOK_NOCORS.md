# RemindIQ 3N.13.3 Apps Script Webhook Compatibility Patch

## Issue

The app shows:

```text
Provider: Google Sheets webhook
Configuration: Ready
Central repository sync failed...
```

This means `.env` is working and the app sees the webhook config, but the actual sync request is failing.

## Likely cause

Google Apps Script web apps often do not return a browser/WebView-readable CORS response.

Your current webhook connector likely does this:

```ts
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

if (!response.ok) fail...
```

In Android WebView, this can fail even when the Apps Script endpoint is valid.

## Fix

For Apps Script webhook mode, use:

```ts
fetch(endpoint, {
  method: "POST",
  mode: "no-cors",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify(payload),
});
```

Then treat the request as sent.

The real confirmation is the Google Sheet row.

## Apply

From project root:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
powershell -ExecutionPolicy Bypass -File apply_3N13_3_apps_script_webhook_nocors_patch.ps1
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then run from Android Studio.

## After install

1. Tap **Clear local feedback** to remove failed old items.
2. Report one fresh issue.
3. Check Google Sheet for a new row.
4. If row appears, webhook is working.

## Apps Script requirement

Your Apps Script `doPost(e)` must parse JSON from:

```js
e.postData.contents
```

This works even when the content type is `text/plain`.
