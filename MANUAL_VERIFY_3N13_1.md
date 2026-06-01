# Manual verification

After applying the patch, open:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
notepad src\lib\reminderEngine.ts
```

Search for:

```text
extractExplicitTitleFromInput
```

Search for:

```text
Which day should I set the alarm
```

Both should be present.

Then build:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```
