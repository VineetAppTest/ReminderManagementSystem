RemindIQ Sprint Voice-1B - Voice Conversation Loop Hardening

This build keeps the native Android voice auto-submit flow and hardens the full voice conversation loop.

What changed:
1. Mic remains the primary next action after MiniViktor asks follow-up questions.
2. Captured native speech auto-submits to MiniViktor; no manual Send is required.
3. The mic button changes to "Mic reply" during an active draft/conversation.
4. A voice-loop hint tells the tester what to say next by voice.
5. Save / change / drop voice commands continue to route through MiniViktor.
6. Typing remains available only as fallback.

Install / sync steps:
1. Replace the files in your RemindIQ project.
2. Run: npm.cmd run build
3. Run: npx.cmd cap sync android
4. Run: npx.cmd cap open android
5. In Android Studio, select the connected Android phone and Run.

Mandatory tests:
1. Speak: Meeting with Raj at 8 PM
   Expected: asks only for day.
2. Speak: Tomorrow
   Expected: confirms event-time reminder assumption.
3. Speak: Earlier reminder at 7 PM
   Expected: event stays 8 PM, reminder becomes 7 PM.
4. Speak: Save it
   Expected: saves without keyboard/manual Send.
5. Speak: Change it to 7:30 PM
   Expected: updates active draft, not a new reminder.

Do not commit if voice capture fills text but requires manual Send.

Sprint Voice-1B Fix 1 - Voice transcript correction recovery
- Normalizes Android speech variants like "Rajat 8 pm" / "Rajat ATM" into "Raj at 8 pm" when time-like context is present.
- Treats "I said ..." / "Actually ..." as a correction reset so bad draft titles do not keep contaminating the next parse.
- Keeps PM punctuation normalization for p.m. / p m / P M before MiniViktor parsing.
- Clears inferred-time confirmation cleanly when the user says incorrect/wrong/change.
