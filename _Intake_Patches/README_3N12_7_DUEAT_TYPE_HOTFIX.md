# RemindIQ 3N.12.7 dueAt TypeScript Hotfix

## Build error fixed

```text
src/App.tsx:1122:64 - error TS2345:
Argument of type 'Reminder' is not assignable to parameter of type 'ReminderLike3N12_5'.
Types of property 'dueAt' are incompatible.
Type 'string | null' is not assignable to type 'string | undefined'.
```

## Root cause

Your app's `Reminder` type allows:

```ts
dueAt: string | null
```

But the bridge type in:

```text
src/native/nativeAlarmBridge3N12_5.ts
```

currently allows only:

```ts
dueAt?: string
```

So TypeScript blocks passing `reminder` into:

```ts
scheduleNativeReminderAlarm3N12_5(reminder)
```

## Fix

Change bridge type from:

```ts
dueAt?: string;
```

to:

```ts
dueAt?: string | null;
```

Also allow alert dueAt to be null.

## Apply

From project root:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
powershell -ExecutionPolicy Bypass -File apply_3N12_7_dueat_type_hotfix.ps1
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then rebuild/run from Android Studio.
