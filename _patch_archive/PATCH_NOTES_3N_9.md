# RemindIQ 3N.9 Intent Parser Hotfix

## Reason for hotfix

The prior patch did not resolve the active issue.

Observed failed conversation:

User: set a reminder for 1 minute from now  
Assistant: Sure — what should I remind you about today at 5:04 pm?  
User: reminder  
Assistant: Sure — what should I remind you about today at 5:04 pm?  
User: name it as reminder  
Assistant: Perfect — as, today, reminder time 5:04 pm. Should I save this reminder, adjust it, or drop it?  
Assistant: Done — I’ll remind you about as today at 5:04 pm.

## Root cause

The parser is incorrectly treating "name it as reminder" as free reminder content and extracting the word "as" as the title.

This is a state-management and intent-priority issue:

1. Once time is already known, the next short user response should be treated as title/content.
2. "name it as X", "call it X", "title it X" must extract X, not "as".
3. The assistant must not ask the same missing-title question again after the user gives a usable title.
4. Save confirmation must use the final resolved title.
5. The reminder object must not save with title "as", "it", "today", "tomorrow", "reminder time", or other parser artifacts.

## Expected corrected conversation

User: set a reminder for 1 minute from now  
Assistant: Sure — what should I remind you about today at 5:04 pm?  
User: reminder  
Assistant: Perfect — reminder, today at 5:04 pm. Should I save this reminder, adjust it, or drop it?  
User: yes  
Assistant: Done — I’ll remind you about reminder today at 5:04 pm.

Alternative:

User: set a reminder for 1 minute from now  
Assistant: Sure — what should I remind you about today at 5:04 pm?  
User: name it as reminder  
Assistant: Perfect — reminder, today at 5:04 pm. Should I save this reminder, adjust it, or drop it?

## Files included

1. `miniViktorIntentFix.ts`
   - Drop-in parser helper for title extraction and draft merge.

2. `reminderRegressionTests.ts`
   - Regression tests for the exact issue and related title phrases.

3. `integration_instructions.md`
   - Where to wire this into the existing RemindIQ flow.

## Mandatory regression cases

The app must pass these before calling the patch successful:

1. "set a reminder for 1 minute from now" → ask for title once.
2. User says "reminder" → draft title becomes "reminder", not repeated question.
3. User says "name it as reminder" → draft title becomes "reminder", not "as".
4. User says "call it medicine" → draft title becomes "medicine".
5. User says "title it water plants" → draft title becomes "water plants".
6. User says "yes" after confirmation → saved reminder title must match the resolved title.
7. Saved reminders array must not be empty after save.
8. Issue feedback export should show valid draft/reminders rather than `null` and `[]`.
