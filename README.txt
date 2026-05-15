RemindIQ Sprint 2H Fix 3 - Saved Reminders + Feedback Tabs

What changed:
1. Saved Reminders and Feedback now sit in the same side/bottom panel.
2. Testers can switch between tabs: Saved reminders | Feedback.
3. Feedback is no longer dependent on a floating mobile overlay.
4. Mobile layout remains one-screen focused.
5. Regression, simulation lab, dataset export, feedback JSON/CSV export are retained.

Required test before commit:
1. npm.cmd run build
2. npm.cmd run preview -- --host 0.0.0.0
3. Open on mobile.
4. Confirm Saved Reminders tab works.
5. Confirm Feedback tab opens and Report Issue works.
6. Confirm End Test / Reset Chat works.
7. Confirm Export JSON/CSV works.
8. Confirm MiniViktor regression still passes.

Commit only if clean:
git status
git add .
git commit -m "Sprint 2H fix saved reminders feedback tabs"
git push
