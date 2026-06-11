# Firebase setup

This branch is connected to the Firebase project `research-analysis-quiz-2026`.
It loads quiz questions from Cloud Firestore and includes an admin dashboard at `admin.html`.
If Firebase is not configured or cannot be reached, the main quiz automatically uses the local files in `data/`.

## Remaining step: enable authentication

1. Open Firebase Authentication.
2. Enable the Email/Password provider.
3. Create the admin user `ahmed01020865017@gmail.com`.

Firebase requires the first Authentication activation from the Console for free-tier projects.
Firestore, rules, web app configuration, Hosting, and the local question import are already complete.

Direct Authentication page:
`https://console.firebase.google.com/project/research-analysis-quiz-2026/authentication/providers`

## Deploy updates

```powershell
npx firebase-tools deploy --only firestore:rules,hosting
```

The included rules allow public reads for the quiz and writes only for `ahmed01020865017@gmail.com`.

Firestore structure:

```text
lectures/{lectureId}
lectures/{lectureId}/questions/{questionId}
```

Public site: `https://research-analysis-quiz-2026.web.app`

Dashboard: `https://research-analysis-quiz-2026.web.app/admin`
