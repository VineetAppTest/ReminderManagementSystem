RemindIQ Sprint 2E-A Fix 5: Final Inference Gate

Purpose:
- Context-based AM/PM inference is allowed.
- Hidden AM/PM inference is not allowed.
- If MiniViktor infers AM/PM from event context/device context, it must explicitly ask the user to confirm the inferred AM/PM before showing save confirmation.

Mandatory test:
1. Meet at 7
2. pm
3. Tomorro
4. Earlier reminder, today at 7 n tmrw at 5

Expected:
MiniViktor must NOT go directly to save confirmation.
It should say something like:
"I’m reading that as today at 7:00 pm and tomorrow at 5:00 pm because Meet is tomorrow at 7:00 pm. Is that correct?"

Then after user says yes/correct/ok:
It can move to save confirmation.

Build:
npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0

Commit only if the inference assumption is visible and save is blocked until confirmed.
