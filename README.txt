RemindIQ Sprint 2H Fix 6 — Mobile Voice Permission + Capture Fix

What this build changes:
1. Adds a stricter HTTPS check before voice starts.
2. Requests microphone permission explicitly before starting SpeechRecognition.
3. Provides clearer mobile voice error messages.
4. Adds a silence timeout so testers do not get stuck in listening mode.
5. Keeps typing, feedback tabs, JSON/CSV export, and MiniViktor brain files intact.

Important:
- Mobile voice should be tested only on the deployed HTTPS Vercel link.
- Local Wi-Fi URLs such as http://192.168.x.x may still fail for voice on phones.
- If the browser does not support Web Speech Recognition, testers should use the phone keyboard mic as fallback.

Test:
1. npm.cmd run build
2. npm.cmd run preview -- --host 0.0.0.0
3. Deploy/push to Vercel for real mobile voice test.
4. On phone, open the HTTPS Vercel link.
5. Allow microphone permission.
6. Tap Speak and speak immediately.
