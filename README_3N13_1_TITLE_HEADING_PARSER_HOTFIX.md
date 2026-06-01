# RemindIQ 3N.13.1 Title / Heading Parser Hotfix

## Issue fixed

UAT feedback:

```text
set an alarm for 6:00 a.m. with title flight to Bombay
```

Current wrong result:

```text
title = set an alarm for with title flight to Bombay
isAlarm = false
```

Expected result:

```text
title = flight to Bombay
time = 6:00 am
isAlarm = true
category = Travel
```

## What this patch changes

This patch updates:

```text
src/lib/reminderEngine.ts
```

It adds explicit title/heading extraction and preserves alarm intent.

## Supported title / heading synonyms

The parser now handles:

```text
with title flight to Bombay
with heading flight to Bombay
with subject flight to Bombay
with name flight to Bombay
with label flight to Bombay
with caption flight to Bombay
with description flight to Bombay
with topic flight to Bombay
title is flight to Bombay
heading is flight to Bombay
subject is flight to Bombay
named flight to Bombay
called flight to Bombay
titled flight to Bombay
headed flight to Bombay
labelled flight to Bombay
labeled flight to Bombay
captioned flight to Bombay
call it flight to Bombay
name it flight to Bombay
title it flight to Bombay
```

## Expected corrected flow

```text
User: set an alarm for 6:00 a.m. with title flight to Bombay
Assistant: Which day should I set the alarm "flight to Bombay" for at 6:00 am?

User: today
Assistant: Alarm "flight to Bombay" is set for today at 6:00 am. Should I save this alarm, adjust it, or drop it?

User: yes
Assistant: Done — I’ll ring the alarm for flight to Bombay today at 6:00 am.
```

## Apply steps

Use the easiest direct replacement method.

### Step 1: Go to the project root

Open PowerShell and run:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
dir
```

Confirm you see:

```text
package.json
src
android
capacitor.config.ts
```

### Step 2: Extract this ZIP into the project root

Extract:

```text
RemindIQ_3N13_1_Title_Heading_Parser_Hotfix.zip
```

directly into:

```text
C:\Users\hp\ReminderManagementSystem-app
```

Allow overwrite when Windows asks.

This should replace:

```text
src\lib\reminderEngine.ts
```

### Step 3: Build

From the same project root:

```cmd
cd C:\Users\hp\ReminderManagementSystem-app
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then run from Android Studio.

## Test cases

Run these after installing:

```text
set an alarm for 6:00 a.m. with title flight to Bombay
today
yes
```

Also test:

```text
set an alarm for 6:00 a.m. with heading flight to Bombay
today
yes
```

```text
set an alarm at 6:00 a.m. called flight to Bombay
today
yes
```

Expected saved reminder/alarm:

```json
{
  "title": "flight to Bombay",
  "timeText": "6:00 am",
  "category": "Travel",
  "isAlarm": true
}
```

## Do not touch native alarm files

This is a parser-only hotfix. The native alarm path from 3N.12.7+ should remain untouched.
