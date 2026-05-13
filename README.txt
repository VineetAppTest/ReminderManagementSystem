RemindIQ Sprint 2E-D: MiniViktor Retriever Brain

Purpose
- Add a solved-example retriever layer before calendar integration.
- Keep guardrails mandatory.
- Keep the existing 30-case regression arena intact.

What changed
- Added src/brain/miniViktorRetriever.ts
- Added public/brain/mini-viktor-solved-examples.json
- Updated src/lib/reminderEngine.ts so MiniViktor retrieves similar solved cases before deciding whether a message is an alert instruction.
- Added a small Retriever brain indicator in the header.

Build
npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0

Required regression
Run MiniViktor regression in the app.
Expected: Passed 30/30, Failed 0, Critical failed 0.

Commit only after regression passes:
git status
git add .
git commit -m "Sprint 2E-D MiniViktor retriever brain"
git tag v2e-d-retriever-brain
