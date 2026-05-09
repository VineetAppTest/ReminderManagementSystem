RemindIQ Sprint 2E-C — MiniViktor Regression Expansion

Purpose:
- Expand MiniViktor regression coverage from 9 cases to 30 cases.
- Keep this sprint focused on brain quality control, not UI or calendar.
- Use this as the stability gate before calendar conflict work.

Files added/updated:
- src/brain/miniViktorRegressionArena.ts
- public/brain/mini-viktor-regression-test-bank.json

Coverage areas:
1. Visible AM/PM inference
2. Candidate compliance
3. Event time vs reminder time
4. Before-event offsets
5. Date typo handling
6. Weekday handling
7. Past reminder guard
8. Missing-detail handling
9. Explicit multi-date reminders
10. Simple complete reminders

Local validation performed while packaging:
- MiniViktor Regression Report
- Passed: 30/30
- Failed: 0
- Critical failed: 0

User test steps:
1. Replace files in your project.
2. Run: npm.cmd run build
3. Run: npm.cmd run preview -- --host 0.0.0.0
4. Open RemindIQ.
5. Run MiniViktor regression report.
6. Expected: Passed 30/30, Failed 0, Critical failed 0.

Git steps after local pass:
- git status
- git add .
- git commit -m "Sprint 2E-C expand MiniViktor regression test bank"
- git tag v2e-c-30-case-regression-pass
- git status

Hard rule:
Do not move to calendar integration unless the local regression report remains 30/30.
