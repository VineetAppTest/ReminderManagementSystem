# Manual Fix

Open:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
notepad src\native\nativeAlarmBridge3N12_5.ts
```

Find this inside `ReminderLike3N12_5`:

```ts
dueAt?: string;
```

Change it to:

```ts
dueAt?: string | null;
```

If you see this inside the `alerts` array:

```ts
alerts?: Array<{
  dueAt?: string;
  timeText?: string;
}>;
```

Change it to:

```ts
alerts?: Array<{
  dueAt?: string | null;
  timeText?: string;
}>;
```

Save, then run:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```
