RemindIQ Sprint 2E-G — MiniViktor Dataset Expansion

Status:
- Expands MiniViktor regression bank from 30 to 75 cases.
- Retains Sprint 2E-D Retriever Brain and Sprint 2E-EF Simulation Lab + Dataset Export foundation.
- No calendar integration in this build.
- No UI beautification in this build.

Expected validation:
- MiniViktor Regression Report: Passed 75/75, Failed 0, Critical failed 0.

Test order:
1. Replace/add files from this ZIP.
2. Run: npm.cmd run build
3. Run: npm.cmd run preview -- --host 0.0.0.0
4. In the app, run MiniViktor Regression Report.
5. Confirm: Passed 75/75, Failed 0, Critical failed 0.
6. Run Simulation Lab and Dataset Export checks.

Commit only if clean:
git status
git add .
git commit -m "Sprint 2E-G expand MiniViktor dataset to 75 cases"
git tag v2e-g-75-case-regression-pass
git status

Hard rule:
If local regression is not 75/75, do not commit and do not move to calendar integration.
