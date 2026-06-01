# RemindIQ 3N.9 Integration Instructions

## 1. Add file

Add `miniViktorIntentFix.ts` to the same folder where the MiniViktor parser / reminder brain lives.

Likely locations in your app:

- `src/lib/`
- `src/utils/`
- `src/miniViktor/`
- `src/services/`

Use the location that already contains reminder parsing or conversation logic.

## 2. Wire before generic NLP parsing

In the function that handles every user message, add the title-handling step before generic parser/date parser logic.

Pseudo integration:

```ts
import {
  applyTitleInputToDraft3N9,
  buildConfirmationText3N9,
  buildSavedText3N9,
  isUsableReminderTitle3N9,
} from "./miniViktorIntentFix";

// inside handleUserMessage(userText)
const updatedDraft = applyTitleInputToDraft3N9(userText, currentDraft, {
  awaitingTitle: conversationState === "awaiting_title",
  hasResolvedTime: Boolean(currentDraft?.dueAt || currentDraft?.timeLabel),
});

if (updatedDraft !== currentDraft && updatedDraft.title) {
  setCurrentDraft(updatedDraft);
  setConversationState("confirming");
  assistantSay(buildConfirmationText3N9(updatedDraft));
  return;
}
```

## 3. Fix confirmation save

When user says "yes", "save", "ok", or taps save, do not reparse the latest user text as title.

Use the current confirmed draft.

```ts
if (conversationState === "confirming" && /^(yes|y|ok|okay|save|confirm|done)$/i.test(userText.trim())) {
  if (!isUsableReminderTitle3N9(currentDraft.title ?? currentDraft.text)) {
    setConversationState("awaiting_title");
    assistantSay("I have the time. What should I remind you about?");
    return;
  }

  saveReminder(currentDraft);
  assistantSay(buildSavedText3N9(currentDraft));
  clearCurrentDraft();
  return;
}
```

## 4. Fix issue feedback export

The issue log currently shows:

- `draft`: null
- `reminders`: []

That makes diagnosis weak.

When a user reports "Did not understand", export these fields:

```ts
{
  draft: currentDraft ?? null,
  reminders: reminders.slice(-5),
  conversationState,
  parserVersion: "3N.9",
}
```

## 5. Mandatory acceptance test

Run this manually on Android WebView / emulator:

Conversation A:

1. `set a reminder for 1 minute from now`
2. App asks only: `what should I remind you about...`
3. `reminder`
4. App says: `Perfect — reminder, today at [time]. Should I save this reminder, adjust it, or drop it?`
5. `yes`
6. App says: `Done — I’ll remind you about reminder today at [time].`

Conversation B:

1. `set a reminder for 1 minute from now`
2. `name it as reminder`
3. App must not save title as `as`.
4. App must not ask the same title question again.
5. Saved reminder title must be `reminder`.

## 6. Build commands

From the project root:

```cmd
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

Then build/run from Android Studio or:

```cmd
cd android
gradlew assembleDebug
```
