export const firebaseConfig = {
  apiKey: "AIzaSyAYXGHYQnXKEOTjWzWrXiHFZOfSYDRw8bE",
  authDomain: "research-analysis-quiz-2026.firebaseapp.com",
  projectId: "research-analysis-quiz-2026",
  storageBucket: "research-analysis-quiz-2026.firebasestorage.app",
  messagingSenderId: "370185344065",
  appId: "1:370185344065:web:29c6b9c8f0cd49f563e2c0",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);
