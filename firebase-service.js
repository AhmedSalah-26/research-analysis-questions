import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let app;
let auth;
let db;

function getFirebase() {
  if (!isFirebaseConfigured) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app, auth, db };
}

async function fetchLectures() {
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase غير مهيأ");

  const lectureSnapshot = await getDocs(query(collection(firebase.db, "lectures"), orderBy("order")));
  return Promise.all(lectureSnapshot.docs.map(async (lectureDoc) => {
    const lecture = lectureDoc.data();
    const questionSnapshot = await getDocs(query(collection(firebase.db, "lectures", lectureDoc.id, "questions"), orderBy("order")));
    return {
      id: lectureDoc.id,
      title: lecture.title,
      fileName: lecture.fileName,
      questions: questionSnapshot.docs.map((questionDoc) => ({
        id: questionDoc.id,
        ...questionDoc.data(),
      })),
    };
  }));
}

export async function loadFirebaseLectures() {
  if (!isFirebaseConfigured) return null;
  try {
    const lectures = await fetchLectures();
    return lectures.length ? lectures : null;
  } catch (error) {
    console.warn("Firebase questions could not be loaded. Using local questions.", error);
    return null;
  }
}

export function watchAuth(callback) {
  const firebase = getFirebase();
  if (!firebase) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(firebase.auth, callback);
}

export async function login(email, password) {
  const firebase = getFirebase();
  if (!firebase) throw new Error("أضف إعدادات Firebase أولًا في firebase-config.js");
  return signInWithEmailAndPassword(firebase.auth, email, password);
}

export async function logout() {
  const firebase = getFirebase();
  if (firebase) await signOut(firebase.auth);
}

export async function getAdminLectures() {
  return fetchLectures();
}

export async function saveLecture(lecture) {
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase غير مهيأ");
  await setDoc(doc(firebase.db, "lectures", lecture.id), {
    title: lecture.title,
    fileName: lecture.fileName,
    order: Number(lecture.order),
  }, { merge: true });
}

export async function saveQuestion(lectureId, question) {
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase غير مهيأ");
  await setDoc(doc(firebase.db, "lectures", lectureId, "questions", String(question.id)), {
    question: question.question,
    answer: question.answer,
    choices: question.choices,
    sourcePage: Number(question.sourcePage || 0),
    order: Number(question.order || question.id),
  });
}

export async function removeQuestion(lectureId, questionId) {
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase غير مهيأ");
  await deleteDoc(doc(firebase.db, "lectures", lectureId, "questions", String(questionId)));
}

export async function importLocalQuestions(lectures, progress = () => {}) {
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase غير مهيأ");

  const writes = [];
  lectures.forEach((lecture, lectureIndex) => {
    writes.push({
      ref: doc(firebase.db, "lectures", lecture.id),
      data: { title: lecture.title, fileName: lecture.fileName, order: lectureIndex + 1 },
    });
    lecture.questions.forEach((question, questionIndex) => {
      writes.push({
        ref: doc(firebase.db, "lectures", lecture.id, "questions", String(question.id)),
        data: {
          question: question.question,
          answer: question.answer,
          choices: question.choices || [],
          sourcePage: Number(question.sourcePage || 0),
          order: questionIndex + 1,
        },
      });
    });
  });

  for (let start = 0; start < writes.length; start += 450) {
    const batch = writeBatch(firebase.db);
    writes.slice(start, start + 450).forEach((write) => batch.set(write.ref, write.data));
    await batch.commit();
    progress(Math.min(start + 450, writes.length), writes.length);
  }
}

export { isFirebaseConfigured };
