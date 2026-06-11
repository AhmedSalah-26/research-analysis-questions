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

function requireFirebase() {
  const firebase = getFirebase();
  if (!firebase) throw new Error("قاعدة البيانات غير مهيأة");
  return firebase;
}

async function fetchCollectionWithQuestions(collectionName) {
  const firebase = requireFirebase();
  const snapshot = await getDocs(query(collection(firebase.db, collectionName), orderBy("order")));
  return Promise.all(snapshot.docs.map(async (itemDoc) => {
    const item = itemDoc.data();
    const questionSnapshot = await getDocs(query(collection(firebase.db, collectionName, itemDoc.id, "questions"), orderBy("order")));
    return {
      id: itemDoc.id,
      ...item,
      questions: questionSnapshot.docs.map((questionDoc) => ({
        id: questionDoc.id,
        ...questionDoc.data(),
      })),
    };
  }));
}

export async function loadPlatformData() {
  const [lectures, exams] = await Promise.all([
    fetchCollectionWithQuestions("lectures"),
    fetchCollectionWithQuestions("exams"),
  ]);
  return { lectures, exams };
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
  const firebase = requireFirebase();
  return signInWithEmailAndPassword(firebase.auth, email, password);
}

export async function logout() {
  const firebase = getFirebase();
  if (firebase) await signOut(firebase.auth);
}

export async function getAdminData() {
  return loadPlatformData();
}

export async function saveLecture(lecture) {
  const firebase = requireFirebase();
  await setDoc(doc(firebase.db, "lectures", lecture.id), {
    title: lecture.title,
    fileName: lecture.fileName,
    order: Number(lecture.order),
  }, { merge: true });
}

export async function removeLecture(lectureId) {
  await removeDocumentTree("lectures", lectureId);
}

export async function saveQuestion(lectureId, question) {
  const firebase = requireFirebase();
  await setDoc(doc(firebase.db, "lectures", lectureId, "questions", String(question.id)), {
    question: question.question,
    answer: question.answer,
    choices: question.choices,
    sourcePage: Number(question.sourcePage || 0),
    order: Number(question.order || question.id),
  });
}

export async function removeQuestion(lectureId, questionId) {
  const firebase = requireFirebase();
  await deleteDoc(doc(firebase.db, "lectures", lectureId, "questions", String(questionId)));
}

export async function saveExam(exam) {
  const firebase = requireFirebase();
  await setDoc(doc(firebase.db, "exams", exam.id), {
    title: exam.title,
    description: exam.description,
    type: exam.type || "exam",
    mode: exam.mode || "random",
    questionCount: Number(exam.questionCount || 100),
    seed: Number(exam.seed || Date.now()),
    order: Number(exam.order),
    active: exam.active !== false,
  }, { merge: true });
}

export async function removeExam(examId) {
  await removeDocumentTree("exams", examId);
}

async function removeDocumentTree(collectionName, itemId) {
  const firebase = requireFirebase();
  const questionSnapshot = await getDocs(collection(firebase.db, collectionName, itemId, "questions"));
  for (let start = 0; start < questionSnapshot.docs.length; start += 450) {
    const batch = writeBatch(firebase.db);
    questionSnapshot.docs.slice(start, start + 450).forEach((questionDoc) => batch.delete(questionDoc.ref));
    await batch.commit();
  }
  await deleteDoc(doc(firebase.db, collectionName, itemId));
}

export { isFirebaseConfigured };
