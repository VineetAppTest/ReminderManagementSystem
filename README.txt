RemindIQ Sprint 2H Fix 1 - One-Screen Beta Layout + Tester Guides

Purpose
This build keeps Sprint 2H External Beta Feedback Mode and improves the beta testing experience.

Changes included
1. More compact mobile layout.
2. Page-level scrolling reduced/disabled so the tester can type without hunting for the input box.
3. Header compressed for one-hand mobile use.
4. Chat and saved reminders use internal scrolling instead of full-page scrolling.
5. Beta feedback section is collapsed by default to reduce screen clutter.
6. Added TESTER_INSTALLATION_GUIDE.txt.
7. Added TESTER_TESTING_GUIDE.txt.

No calendar integration is included.
No major MiniViktor logic change is intended in this build.

Test before commit
1. npm.cmd run build
2. npm.cmd run preview -- --host 0.0.0.0
3. Confirm app fits better on phone without needing page scroll to type.
4. Confirm Report Issue still works.
5. Confirm Export JSON/CSV still works.
6. Confirm MiniViktor regression still passes.

Commit message suggestion
git add .
git commit -m "Sprint 2H one-screen beta layout and tester guides"
