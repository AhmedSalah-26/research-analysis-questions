import {
  getAdminLectures,
  importLocalQuestions,
  isFirebaseConfigured,
  login,
  logout,
  removeQuestion,
  saveQuestion,
  watchAuth,
} from "./firebase-service.js";

const loginScreen = document.querySelector("#login-screen");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const lectureFilter = document.querySelector("#lecture-filter");
const questionLecture = document.querySelector("#question-lecture");
const questionList = document.querySelector("#admin-question-list");
const editorOverlay = document.querySelector("#editor-overlay");
const questionForm = document.querySelector("#question-form");
const statusLine = document.querySelector("#status-line");

let lectures = [];
let selectedLectureId = "";
let editingQuestionId = "";

function setStatus(message) {
  statusLine.textContent = message;
}

function populateLectureSelects() {
  const options = lectures.map((lecture) => `<option value="${lecture.id}">${lecture.title}</option>`).join("");
  lectureFilter.innerHTML = options;
  questionLecture.innerHTML = options;
  if (!selectedLectureId && lectures.length) selectedLectureId = lectures[0].id;
  lectureFilter.value = selectedLectureId;
}

function renderStats() {
  const total = lectures.reduce((sum, lecture) => sum + lecture.questions.length, 0);
  const current = lectures.find((lecture) => lecture.id === selectedLectureId);
  document.querySelector("#lecture-stat").textContent = lectures.length;
  document.querySelector("#question-stat").textContent = total;
  document.querySelector("#current-stat").textContent = current?.questions.length || 0;
}

function renderQuestions() {
  const lecture = lectures.find((item) => item.id === selectedLectureId);
  const term = document.querySelector("#question-search").value.trim().toLowerCase();
  const questions = (lecture?.questions || []).filter((question) =>
    `${question.question} ${question.answer}`.toLowerCase().includes(term));

  questionList.innerHTML = questions.length ? questions.map((question) => `
    <article class="admin-question">
      <span class="admin-question-number">#${question.id}</span>
      <div><strong>${escapeHtml(question.question)}</strong><small>${escapeHtml(question.answer)}</small></div>
      <div class="row-actions">
        <button type="button" data-edit="${question.id}">تعديل</button>
        <button class="delete-button" type="button" data-delete="${question.id}">حذف</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">لا توجد أسئلة مطابقة.</div>';
  renderStats();
}

async function loadDashboardData() {
  setStatus("جاري تحميل البيانات من Firebase...");
  try {
    lectures = await getAdminLectures();
    populateLectureSelects();
    renderQuestions();
    setStatus(lectures.length ? "تم تحميل البيانات من Firebase" : "لا توجد بيانات. استخدم زر استيراد الأسئلة المحلية.");
  } catch (error) {
    setStatus(`تعذر تحميل البيانات: ${error.message}`);
  }
}

function openEditor(question = null) {
  editingQuestionId = question ? String(question.id) : "";
  document.querySelector("#editor-title").textContent = question ? "تعديل السؤال" : "إضافة سؤال";
  document.querySelector("#question-id").value = editingQuestionId;
  questionLecture.value = selectedLectureId;
  document.querySelector("#question-text").value = question?.question || "";
  document.querySelector("#question-answer").value = question?.answer || "";
  document.querySelector("#question-choices").value = (question?.choices || []).join("\n");
  document.querySelector("#question-page").value = question?.sourcePage || 0;
  editorOverlay.classList.remove("is-hidden");
}

function closeEditor() {
  editorOverlay.classList.add("is-hidden");
  questionForm.reset();
  editingQuestionId = "";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#login-message");
  message.textContent = "جاري تسجيل الدخول...";
  try {
    await login(document.querySelector("#login-email").value, document.querySelector("#login-password").value);
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message.includes("configuration-not-found")
      ? "فعّل Email/Password من Firebase Authentication أولًا."
      : error.message;
  }
});

watchAuth(async (user) => {
  loginScreen.classList.toggle("is-hidden", Boolean(user));
  dashboard.classList.toggle("is-hidden", !user);
  if (user) {
    document.querySelector("#admin-email").textContent = user.email;
    await loadDashboardData();
  } else if (!isFirebaseConfigured) {
    document.querySelector("#login-message").textContent = "أضف إعدادات Firebase في firebase-config.js أولًا.";
  }
});

document.querySelector("#logout-button").addEventListener("click", logout);
document.querySelector("#refresh-button").addEventListener("click", loadDashboardData);
document.querySelector("#add-question-button").addEventListener("click", () => openEditor());
document.querySelector("#close-editor").addEventListener("click", closeEditor);
document.querySelector("#cancel-editor").addEventListener("click", closeEditor);
editorOverlay.addEventListener("click", (event) => { if (event.target === editorOverlay) closeEditor(); });

lectureFilter.addEventListener("change", () => {
  selectedLectureId = lectureFilter.value;
  renderQuestions();
});
document.querySelector("#question-search").addEventListener("input", renderQuestions);

questionList.addEventListener("click", async (event) => {
  const lecture = lectures.find((item) => item.id === selectedLectureId);
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) openEditor(lecture.questions.find((question) => String(question.id) === editButton.dataset.edit));
  if (deleteButton && confirm("هل تريد حذف هذا السؤال نهائيًا؟")) {
    try {
      setStatus("جاري حذف السؤال...");
      await removeQuestion(selectedLectureId, deleteButton.dataset.delete);
      await loadDashboardData();
    } catch (error) {
      setStatus(`تعذر حذف السؤال: ${error.message}`);
    }
  }
});

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const lectureId = questionLecture.value;
  const lecture = lectures.find((item) => item.id === lectureId);
  const nextId = editingQuestionId || String(Math.max(0, ...(lecture?.questions || []).map((question) => Number(question.id) || 0)) + 1);
  const answer = document.querySelector("#question-answer").value.trim();
  const choices = [...new Set(document.querySelector("#question-choices").value.split("\n").map((choice) => choice.trim()).filter(Boolean))];
  if (!choices.includes(answer)) choices.unshift(answer);
  if (choices.length < 2) {
    setStatus("أضف اختيارين على الأقل لكل سؤال.");
    return;
  }

  try {
    setStatus("جاري حفظ السؤال...");
    await saveQuestion(lectureId, {
      id: nextId,
      order: Number(nextId) || Date.now(),
      question: document.querySelector("#question-text").value.trim(),
      answer,
      choices,
      sourcePage: document.querySelector("#question-page").value,
    });
    selectedLectureId = lectureId;
    closeEditor();
    await loadDashboardData();
  } catch (error) {
    setStatus(`تعذر حفظ السؤال: ${error.message}`);
  }
});

document.querySelector("#import-button").addEventListener("click", async () => {
  if (!confirm("سيتم رفع جميع الأسئلة المحلية إلى Firebase وتحديث الأسئلة الموجودة. هل تريد المتابعة؟")) return;
  try {
    setStatus("جاري استيراد الأسئلة المحلية...");
    await importLocalQuestions(window.QUIZ_DATA || [], (done, total) => setStatus(`تم رفع ${done} من ${total}`));
    await loadDashboardData();
  } catch (error) {
    setStatus(`تعذر استيراد الأسئلة: ${error.message}`);
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
