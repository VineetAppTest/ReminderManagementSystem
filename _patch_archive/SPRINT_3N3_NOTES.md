# Sprint 3N.3 Notes

## Important expectation
Android full-screen launch is OS-controlled. This patch does not falsely claim full-screen will always auto-open. It adds diagnostics so the tester can see whether Android permits or blocks full-screen intent.

## Accepted fallback
If Android blocks full-screen intent, notification tap and notification actions remain the correct fallback path.
