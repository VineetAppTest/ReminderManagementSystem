RemindIQ — Sprint 2E-B: MiniViktor Test Arena + Regression Report

Purpose
-------
This sprint does not add calendar, UI beautification, or new reminder features.
It adds a measurable MiniViktor regression arena so the brain can be checked before future sprints.

What changed
------------
1. Added src/brain/miniViktorRegressionArena.ts
2. Added public/brain/mini-viktor-regression-test-bank.json
3. Updated src/App.tsx with a MiniViktor Test Arena section.
4. Added on-screen Run regression and Copy report actions.
5. Added report categories, pass/fail count, critical failure count, and failure details.

How to use
----------
1. Replace/add files from this ZIP into your project.
2. Run:
   npm.cmd run build
3. Run:
   npm.cmd run preview -- --host 0.0.0.0
4. Open RemindIQ.
5. Scroll to Saved reminders > MiniViktor test arena.
6. Click Run regression.

Commit rule
-----------
Do not move to calendar integration if Critical failed is greater than 0.
Critical failures mean MiniViktor is still violating the reminder-brain rules.

Recommended commit after successful build/test
----------------------------------------------
git status
git add .
git commit -m "Sprint 2E-B MiniViktor test arena regression report"
git status


Sprint 2E-B Fix 1: Event/Reminder Regression Repair
- Preserves event date when reminder time is added later.
- Applies half-hour / before-event offsets after the event date is supplied.
- Parses phrases such as “as lunch is at 1.10” as event time.
- Parses “reminder at 12 and then at 1” as multiple reminder alerts.
- Regression arena target: Passed 9/9, Critical failed 0.
