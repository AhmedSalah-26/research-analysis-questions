import {
  getAdminData,
  isFirebaseConfigured,
  login,
  logout,
  removeExam,
  removeLecture,
  removeQuestion,
  saveExam,
  saveLecture,
  saveQuestion,
  watchAuth,
} from "./firebase-service.js";

const $ = (selector) => document.querySelector(selector);
const loginScreen = $("#login-screen");
const dashboard = $("#dashboard");
const lectureFilter = $("#lecture-filter");
const questionLecture = $("#question-lecture");
const questionList = $("#admin-question-list");
const examList = $("#admin-exam-list");
const statusLine = $("#status-line");

let lectures = [];
let exams = [];
let selectedLectureId = "";
let editingQuestionId = "";
let editingLectureId = "";
let editingExamId = "";

function setStatus(message) {
  statusLine.textContent = message;
}

window.addEventListener("unhandledrejection", (event) => {
  setStatus(`تعذر تنفيذ العملية: ${event.reason?.message || event.reason}`);
});

function closeEditors() {
  document.querySelectorAll(".editor-overlay").forEach((editor) => editor.classList.add("is-hidden"));
}

function populateLectureSelects() {
  const options = lectures.map((lecture) => `<option value="${lecture.id}">${escapeHtml(lecture.title)}</option>`).join("");
  lectureFilter.innerHTML = options;
  questionLecture.innerHTML = options;
  if (!lectures.some((lecture) => lecture.id === selectedLectureId)) selectedLectureId = lectures[0]?.id || "";
  lectureFilter.value = selectedLectureId;
  $("#add-question-button").disabled = !lectures.length;
  $("#edit-lecture-button").disabled = !lectures.length;
  $("#delete-lecture-button").disabled = !lectures.length;
}

function renderStats() {
  const total = lectures.reduce((sum, lecture) => sum + lecture.questions.length, 0);
  const current = lectures.find((lecture) => lecture.id === selectedLectureId);
  $("#lecture-stat").textContent = lectures.length;
  $("#question-stat").textContent = total;
  $("#exam-stat").textContent = exams.length;
  $("#current-stat").textContent = current?.questions.length || 0;
}

function renderQuestions() {
  const lecture = lectures.find((item) => item.id === selectedLectureId);
  const term = $("#question-search").value.trim().toLowerCase();
  const questions = (lecture?.questions || []).filter((question) =>
    `${question.question} ${question.answer}`.toLowerCase().includes(term));

  questionList.innerHTML = questions.length ? questions.map((question) => `
    <article class="admin-question">
      <span class="admin-question-number">#${escapeHtml(question.id)}</span>
      <div><strong>${escapeHtml(question.question)}</strong><small>${escapeHtml(question.answer)}</small></div>
      <div class="row-actions">
        <button type="button" data-edit-question="${question.id}">تعديل</button>
        <button class="delete-button" type="button" data-delete-question="${question.id}">حذف</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">لا توجد أسئلة في هذه المحاضرة.</div>';
  renderStats();
}

function renderExams() {
  examList.innerHTML = exams.length ? exams.map((exam) => `
    <article class="admin-question">
      <span class="admin-question-number">${exam.active === false ? "مخفي" : "ظاهر"}</span>
      <div><strong>${escapeHtml(exam.title)}</strong><small>${escapeHtml(exam.description)} · ${exam.questionCount} سؤال</small></div>
      <div class="row-actions">
        <button type="button" data-edit-exam="${exam.id}">تعديل</button>
        <button class="delete-button" type="button" data-delete-exam="${exam.id}">حذف</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">لا توجد اختبارات بعد.</div>';
  renderStats();
}

async function loadDashboardData() {
  setStatus("جاري تحميل البيانات...");
  try {
    const data = await getAdminData();
    lectures = data.lectures;
    exams = data.exams;
    populateLectureSelects();
    renderQuestions();
    renderExams();
    setStatus("تم تحميل أحدث البيانات");
  } catch (error) {
    setStatus(`تعذر تحميل البيانات: ${error.message}`);
  }
}

function openQuestionEditor(question = null) {
  editingQuestionId = question ? String(question.id) : "";
  $("#question-editor-title").textContent = question ? "تعديل السؤال" : "إضافة سؤال";
  questionLecture.value = selectedLectureId;
  $("#question-text").value = question?.question || "";
  $("#question-answer").value = question?.answer || "";
  $("#question-choices").value = (question?.choices || []).join("\n");
  $("#question-page").value = question?.sourcePage || 0;
  $("#question-editor").classList.remove("is-hidden");
}

function openLectureEditor(lecture = null) {
  editingLectureId = lecture?.id || "";
  $("#lecture-editor-title").textContent = lecture ? "تعديل المحاضرة" : "إضافة محاضرة";
  $("#lecture-id").value = lecture?.id || `lecture${lectures.length + 1}`;
  $("#lecture-id").disabled = Boolean(lecture);
  $("#lecture-title").value = lecture?.title || "";
  $("#lecture-file-name").value = lecture?.fileName || "";
  $("#lecture-order").value = lecture?.order || lectures.length + 1;
  $("#lecture-editor").classList.remove("is-hidden");
}

function openExamEditor(exam = null) {
  editingExamId = exam?.id || "";
  $("#exam-editor-title").textContent = exam ? "تعديل الاختبار" : "إضافة اختبار";
  $("#exam-id").value = exam?.id || `exam${exams.length + 1}`;
  $("#exam-id").disabled = Boolean(exam);
  $("#exam-title").value = exam?.title || "";
  $("#exam-description").value = exam?.description || "اختبار شامل من جميع المحاضرات";
  $("#exam-question-count").value = exam?.questionCount || 100;
  $("#exam-order").value = exam?.order || exams.length + 1;
  $("#exam-seed").value = exam?.seed || Date.now();
  $("#exam-active").checked = exam?.active !== false;
  $("#exam-editor").classList.remove("is-hidden");
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("#login-message");
  message.textContent = "جاري تسجيل الدخول...";
  try {
    await login($("#login-email").value, $("#login-password").value);
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
});

watchAuth(async (user) => {
  loginScreen.classList.toggle("is-hidden", Boolean(user));
  dashboard.classList.toggle("is-hidden", !user);
  if (user) {
    $("#admin-email").textContent = user.email;
    await loadDashboardData();
  } else if (!isFirebaseConfigured) {
    $("#login-message").textContent = "قاعدة البيانات غير مهيأة.";
  }
});

$("#logout-button").addEventListener("click", logout);
$("#refresh-button").addEventListener("click", loadDashboardData);
$("#add-question-button").addEventListener("click", () => openQuestionEditor());
$("#add-lecture-button").addEventListener("click", () => openLectureEditor());
$("#add-exam-button").addEventListener("click", () => openExamEditor());
$("#panel-add-exam-button").addEventListener("click", () => openExamEditor());
$("#edit-lecture-button").addEventListener("click", () => openLectureEditor(lectures.find((lecture) => lecture.id === selectedLectureId)));
document.querySelectorAll("[data-close-editor]").forEach((button) => button.addEventListener("click", closeEditors));
document.querySelectorAll(".editor-overlay").forEach((editor) => editor.addEventListener("click", (event) => {
  if (event.target === editor) closeEditors();
}));

lectureFilter.addEventListener("change", () => {
  selectedLectureId = lectureFilter.value;
  renderQuestions();
});
$("#question-search").addEventListener("input", renderQuestions);

questionList.addEventListener("click", async (event) => {
  const lecture = lectures.find((item) => item.id === selectedLectureId);
  const editButton = event.target.closest("[data-edit-question]");
  const deleteButton = event.target.closest("[data-delete-question]");
  if (editButton) openQuestionEditor(lecture.questions.find((question) => String(question.id) === editButton.dataset.editQuestion));
  if (deleteButton && confirm("هل تريد حذف هذا السؤال نهائيًا؟")) {
    setStatus("جاري حذف السؤال...");
    await removeQuestion(selectedLectureId, deleteButton.dataset.deleteQuestion);
    await loadDashboardData();
  }
});

examList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-exam]");
  const deleteButton = event.target.closest("[data-delete-exam]");
  if (editButton) openExamEditor(exams.find((exam) => exam.id === editButton.dataset.editExam));
  if (deleteButton && confirm("هل تريد حذف هذا الاختبار نهائيًا؟")) {
    setStatus("جاري حذف الاختبار...");
    await removeExam(deleteButton.dataset.deleteExam);
    await loadDashboardData();
  }
});

$("#delete-lecture-button").addEventListener("click", async () => {
  const lecture = lectures.find((item) => item.id === selectedLectureId);
  if (!lecture || !confirm(`سيتم حذف "${lecture.title}" وكل أسئلتها نهائيًا. هل تريد المتابعة؟`)) return;
  setStatus("جاري حذف المحاضرة...");
  await removeLecture(lecture.id);
  selectedLectureId = "";
  await loadDashboardData();
});

$("#question-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const lectureId = questionLecture.value;
  const lecture = lectures.find((item) => item.id === lectureId);
  const nextId = editingQuestionId || String(Math.max(0, ...(lecture?.questions || []).map((question) => Number(question.id) || 0)) + 1);
  const answer = $("#question-answer").value.trim();
  const choices = [...new Set($("#question-choices").value.split("\n").map((choice) => choice.trim()).filter(Boolean))];
  if (!choices.includes(answer)) choices.unshift(answer);
  if (choices.length < 2) return setStatus("أضف اختيارين على الأقل لكل سؤال.");
  setStatus("جاري حفظ السؤال...");
  await saveQuestion(lectureId, {
    id: nextId,
    order: Number(nextId) || Date.now(),
    question: $("#question-text").value.trim(),
    answer,
    choices,
    sourcePage: $("#question-page").value,
  });
  selectedLectureId = lectureId;
  closeEditors();
  await loadDashboardData();
});

$("#lecture-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = editingLectureId || $("#lecture-id").value.trim();
  setStatus("جاري حفظ المحاضرة...");
  await saveLecture({
    id,
    title: $("#lecture-title").value.trim(),
    fileName: $("#lecture-file-name").value.trim(),
    order: $("#lecture-order").value,
  });
  selectedLectureId = id;
  closeEditors();
  await loadDashboardData();
});

$("#exam-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("جاري حفظ الاختبار...");
  await saveExam({
    id: editingExamId || $("#exam-id").value.trim(),
    title: $("#exam-title").value.trim(),
    description: $("#exam-description").value.trim(),
    questionCount: $("#exam-question-count").value,
    order: $("#exam-order").value,
    seed: $("#exam-seed").value,
    active: $("#exam-active").checked,
    type: editingExamId ? exams.find((exam) => exam.id === editingExamId)?.type : "exam",
    mode: editingExamId ? exams.find((exam) => exam.id === editingExamId)?.mode : "random",
  });
  closeEditors();
  await loadDashboardData();
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
