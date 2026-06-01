# Manual verification for 3N.13.2 Google Form feedback sync

Open:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
notepad .env
```

Confirm all Google Form values are present.

Then run:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Run from Android Studio and submit a test feedback item.
