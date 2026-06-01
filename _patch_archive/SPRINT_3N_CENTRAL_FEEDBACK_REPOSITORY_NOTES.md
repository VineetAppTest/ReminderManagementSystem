# RemindIQ Sprint 3N — Centralized Feedback Repository

## What this sprint adds
1. In-app feedback continues to capture full tester context.
2. Feedback now supports central sync to Supabase when repository keys are configured.
3. Feedback is always stored locally first, then synced centrally when online.
4. Sync status is visible inside the Feedback panel.
5. Version/build label is visible under the RemindIQ brand so testers can confirm the exact build.
6. JSON/CSV export remains as a fallback only.

## Environment variables
Create a `.env` file in the project root with:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_FEEDBACK_TABLE=remindiq_feedback_items
```

## Supabase table setup
Run the SQL from `SUPABASE_FEEDBACK_SETUP.sql` in the Supabase SQL editor.

## How it works
- Tester taps **Feedback** → selects issue type → optional comment → **Report issue**.
- App captures:
  - tester id
  - issue type
  - comment
  - conversation
  - active draft
  - visible reminders snapshot
  - app URL
  - user agent
  - build label
  - app version
  - platform / native shell flag
- Item is stored locally immediately.
- If repository keys are configured, the app also syncs the issue into Supabase.

## Build / run
```bash
npm run build
npx cap sync android
npx cap open android
```

## Testing checklist
1. Open Feedback panel.
2. Confirm build label shows `Sprint 3N · Centralized Feedback Repository`.
3. Report a sample issue while repository keys are NOT configured.
   - Expected: issue stored locally, sync card says not configured.
4. Add repository keys and relaunch.
   - Expected: pending items auto-sync.
5. Report a fresh issue with repository configured.
   - Expected: assistant says issue queued for central repository.
   - Expected: sync card updates successfully.
6. Export JSON and CSV.
   - Expected: export still works as fallback.
7. Clear local feedback only after confirming sync is complete.

## Notes
- This sprint does **not** do autonomous code rewriting.
- It lays the foundation for centralized issue capture, prioritization, and future self-heal workflows.
