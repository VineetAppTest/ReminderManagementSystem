RemindIQ Sprint 2H Fix 5 — Mobile Input Zoom Fix

Purpose:
- Prevent mobile browser auto-zoom when testers tap feedback inputs, comments, dropdowns, or the main message box.
- Keep the compact feedback-first tab layout from Sprint 2H Fix 4.
- Keep Saved Reminders + Feedback tabs unchanged.

Important:
- This does not disable user zoom globally. It fixes browser auto-zoom by keeping focused controls at mobile-safe font sizing.

Test checklist:
1. Run: npm.cmd run build
2. Run: npm.cmd run preview -- --host 0.0.0.0
3. On mobile, open the app.
4. Tap Feedback tab.
5. Tap Tester ID, Issue Type, and Optional Comments.
6. Screen should not zoom in/out repeatedly.
7. Report Issue, End Test, Export JSON, and Export CSV should remain usable.
8. Run MiniViktor regression and confirm it still passes.
