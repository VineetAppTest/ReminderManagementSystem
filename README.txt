RemindIQ Sprint 2H Fix 7 — Mobile Voice Direct Start

Purpose:
- Fixes mobile voice path where the browser shows microphone permission as allowed but SpeechRecognition still returns not-allowed.
- Removes the separate getUserMedia permission pre-check because it can consume the mobile user gesture before SpeechRecognition.start().
- Starts SpeechRecognition directly from the Speak button tap.
- Keeps clearer fallback messaging and recommends phone keyboard mic if browser speech service still fails.

Test on deployed HTTPS Vercel link, not local http://192.x preview.
