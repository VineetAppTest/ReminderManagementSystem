# Firebase Feedback Setup for RemindIQ 3N.2

## 1. Create Firebase project
Use Firebase Console and create a project for RemindIQ feedback.

## 2. Create Firestore database
Create a Firestore database in Native mode.

Recommended collection name:

```text
remindiq_feedback_items
```

## 3. Get web API key and project ID
From Firebase project settings, copy:

```text
Project ID
Web API key
```

## 4. Add .env values
Create/update `.env` in the RemindIQ root folder:

```env
VITE_FEEDBACK_PROVIDER=firebase
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_FEEDBACK_COLLECTION=remindiq_feedback_items
```

## 5. Rebuild

```powershell
npm run build
npx cap sync android
```

## 6. Test
Open the app > Feedback > submit test issue.

Expected:

```text
Issue captured and queued for the central repository
```

Then check Firestore collection:

```text
remindiq_feedback_items
```
