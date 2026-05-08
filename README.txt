RemindIQ Sprint 2B - Voice Reliability + HTTPS Deployment Prep

Replace/add all files in your existing project.

Included:
1. Better voice error messages.
2. Microphone permission diagnostics.
3. Voice auto-sends captured speech into the same reminder engine.
4. Clearer handling for local mobile HTTP preview vs HTTPS deployment.
5. PWA service worker registration for HTTPS/localhost.
6. Current Sprint 2A reminder logic retained.

Test locally:
npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0

Phone local testing:
Open the Network URL on phone. Typing should work. Browser alerts may say HTTPS needed.
Voice may still be limited on local HTTP. Final voice testing should be done after HTTPS deployment.

Recommended Git commit after successful test:
git status
git add .
git commit -m "Sprint 2B voice reliability and HTTPS prep"
git status
