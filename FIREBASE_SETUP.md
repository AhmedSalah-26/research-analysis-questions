# Firebase setup

This branch is connected to the Firebase project `research-analysis-quiz-2026`.
It loads lectures, questions, and exams from Cloud Firestore and includes an admin dashboard at `admin.html`.

## Authentication

Email/Password Authentication is enabled and the admin user is:
`ahmed01020865017@gmail.com`

Firestore, rules, web app configuration, Hosting, Authentication, and the question bank are complete.

## Deploy updates

```powershell
npx firebase-tools deploy --only firestore:rules,hosting
```

The included rules allow public reads for the quiz and writes only for `ahmed01020865017@gmail.com`.

Firestore structure:

```text
lectures/{lectureId}
lectures/{lectureId}/questions/{questionId}
exams/{examId}
exams/{examId}/questions/{questionId}
```

Public site: `https://research-analysis-quiz-2026.web.app`

Dashboard: `https://research-analysis-quiz-2026.web.app/admin`
