# Firebase setup

This branch loads quiz questions from Cloud Firestore and includes an admin dashboard at `admin.html`.
If Firebase is not configured or cannot be reached, the main quiz automatically uses the local files in `data/`.

## 1. Create the Firebase project

1. Create a Firebase project.
2. Add a Web app to the project.
3. Copy the web app configuration into `firebase-config.js`.

## 2. Enable authentication

1. Open Firebase Authentication.
2. Enable the Email/Password provider.
3. Create the admin user that will access `admin.html`.

## 3. Create Firestore

1. Create a Cloud Firestore database.
2. Deploy the included rules:

```powershell
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules,hosting
```

The included rules allow public reads for the quiz and authenticated writes for the dashboard.
Use only admin accounts in Firebase Authentication.

## 4. Import the local question bank

1. Open `admin.html`.
2. Sign in with the Firebase admin account.
3. Click **استيراد الأسئلة المحلية**.

Firestore structure:

```text
lectures/{lectureId}
lectures/{lectureId}/questions/{questionId}
```

After import, reload `index.html`. The source badge in the header will show `Firebase`.
