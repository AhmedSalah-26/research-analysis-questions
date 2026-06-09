const quizData = window.QUIZ_DATA || [];
const welcomeScreen = document.querySelector("#welcome-screen");
const lectureSection = document.querySelector("#lecture-section");
const lectureGrid = document.querySelector("#lecture-grid");
const examSection = document.querySelector("#exam-section");
const examGrid = document.querySelector("#exam-grid");
const quizScreen = document.querySelector("#quiz-screen");
const questionList = document.querySelector("#question-list");
const quizForm = document.querySelector("#quiz-form");
const resultOverlay = document.querySelector("#result-overlay");
const topbarTotal = document.querySelector("#topbar-total");
const topbarProgress = document.querySelector("#topbar-progress");
const topbar = document.querySelector(".topbar");
const issueNav = document.querySelector("#issue-nav");
const issuePosition = document.querySelector("#issue-position");

let currentLecture = null;
let graded = false;
let lastScrollY = window.scrollY;
let issueIndex = 0;

const hasChoices = (question) => Array.isArray(question.choices) && question.choices.length > 1;
const questionKey = (question) => `q-${question.id}`;

function seededShuffle(items, seed) {
  const shuffled = [...items];
  let state = seed;
  const random = () => {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };

  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function buildComprehensiveExam(examNumber) {
  const seed = 20260609 + examNumber * 7919;
  const questionPool = quizData.map((lecture, lectureIndex) => lecture.questions
    .filter(hasChoices)
    .map((question) => ({
      ...question,
      id: `${lecture.id}-${question.id}`,
      sourceLectureNumber: lectureIndex + 1,
    })));
  const selected = questionPool.flatMap((questions, lectureIndex) =>
    seededShuffle(questions, seed + lectureIndex * 101).slice(0, 14));
  const selectedIds = new Set(selected.map((question) => question.id));
  const remaining = questionPool.flat().filter((question) => !selectedIds.has(question.id));
  const questions = seededShuffle(
    [...selected, ...seededShuffle(remaining, seed + 997).slice(0, 2)],
    seed + 1997,
  );

  return {
    id: `exam${examNumber}`,
    type: "exam",
    title: `الاختبار الشامل ${examNumber}`,
    fileName: "100 سؤال من المحاضرات السبع",
    questions,
  };
}

const comprehensiveExams = Array.from({ length: 10 }, (_, index) => buildComprehensiveExam(index + 1));
const allQuizzes = [...quizData, ...comprehensiveExams];

const storageKey = (lectureId) => `research-quiz:${lectureId}`;
const getSaved = (lectureId) => JSON.parse(localStorage.getItem(storageKey(lectureId)) || "{}");
const saveAnswers = () => {
  if (!currentLecture) return;
  const answers = {};
  new FormData(quizForm).forEach((value, key) => { answers[key] = value; });
  localStorage.setItem(storageKey(currentLecture.id), JSON.stringify(answers));
  updateProgress();
  renderLectureCards();
  renderExamCards();
};

const getOptions = (question) => {
  if (Array.isArray(question.choices) && question.choices.length > 1) {
    const choices = [...new Set([...question.choices, question.answer].filter(Boolean))];
    return choices;
  }
  return [];
};

function renderLectureCards() {
  lectureGrid.innerHTML = quizData.map((lecture) => {
    const originalQuestions = lecture.questions.filter(hasChoices);
    const savedCount = Object.keys(getSaved(lecture.id)).length;
    const percent = originalQuestions.length ? Math.round((savedCount / originalQuestions.length) * 100) : 0;
    return `
      <button class="lecture-card" type="button" data-lecture="${lecture.id}">
        <span class="lecture-card-number">${lecture.id.replace(/\D/g, "")}</span>
        <small>${lecture.fileName}</small>
        <strong>${lecture.title}</strong>
        <span>${originalQuestions.length} من ${lecture.questions.length} سؤال مطابق للملف · تم حل ${savedCount}</span>
        <div class="lecture-progress"><i style="width:${percent}%"></i></div>
      </button>
    `;
  }).join("");
}

function renderExamCards() {
  examGrid.innerHTML = comprehensiveExams.map((exam, index) => {
    const savedCount = Object.keys(getSaved(exam.id)).length;
    const percent = Math.round((savedCount / exam.questions.length) * 100);
    return `
      <button class="exam-card" type="button" data-quiz="${exam.id}">
        <div class="exam-card-top">
          <small>اختبار شامل · المحاضرات السبع</small>
          <b class="exam-card-number">${String(index + 1).padStart(2, "0")}</b>
        </div>
        <strong>${exam.title}</strong>
        <span>100 سؤال عشوائي · تم حل ${savedCount}</span>
        <div class="lecture-progress"><i style="width:${percent}%"></i></div>
      </button>
    `;
  }).join("");
}

function renderQuestions() {
  const saved = getSaved(currentLecture.id);
  const originalQuestions = currentLecture.questions.filter(hasChoices);
  questionList.innerHTML = originalQuestions.map((question, index) => {
    const options = getOptions(question);
    const questionLabel = currentLecture.type === "exam"
      ? `سؤال ${index + 1} · المحاضرة ${question.sourceLectureNumber}`
      : `سؤال ${question.id}`;
    return `
      <article class="question-card" id="question-${question.id}" data-answer="${escapeHtml(question.answer)}">
        <span class="question-number">${questionLabel}</span>
        <h3>${escapeHtml(question.question)}</h3>
        <div class="options">
          ${options.map((option) => `
            <label class="option">
              <input type="radio" name="${questionKey(question)}" value="${escapeHtml(option)}" ${saved[questionKey(question)] === option ? "checked" : ""} />
              <span>${escapeHtml(option)}</span>
            </label>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
  updateProgress();
}

function openQuiz(quizId, push = true) {
  currentLecture = allQuizzes.find((quiz) => quiz.id === quizId);
  if (!currentLecture) return;
  graded = false;
  issueNav.classList.add("is-hidden");
  topbar.classList.remove("is-scroll-hidden");
  document.querySelector("#quiz-title").textContent = currentLecture.title;
  document.querySelector("#quiz-file-name").textContent = currentLecture.fileName;
  welcomeScreen.classList.add("is-hidden");
  lectureSection.classList.add("is-hidden");
  examSection.classList.add("is-hidden");
  quizScreen.classList.remove("is-hidden");
  topbarTotal.classList.add("is-hidden");
  topbarProgress.classList.remove("is-hidden");
  renderQuestions();
  document.querySelector("#result-kicker").textContent = currentLecture.type === "exam" ? "نتيجة الاختبار الشامل" : "نتيجة المحاضرة";
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (push) history.pushState({ screen: "quiz", id: quizId }, "", "#" + quizId);
}

function showHome() {
  currentLecture = null;
  graded = false;
  issueNav.classList.add("is-hidden");
  topbar.classList.remove("is-scroll-hidden");
  quizScreen.classList.add("is-hidden");
  welcomeScreen.classList.remove("is-hidden");
  lectureSection.classList.remove("is-hidden");
  examSection.classList.remove("is-hidden");
  resultOverlay.classList.add("is-hidden");
  topbarProgress.classList.add("is-hidden");
  topbarTotal.classList.remove("is-hidden");
  renderLectureCards();
  renderExamCards();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateProgress() {
  if (!currentLecture) return;
  const answered = new FormData(quizForm).keys();
  const count = [...answered].length;
  const total = currentLecture.questions.filter(hasChoices).length;
  document.querySelector("#answered-count").textContent = `${count} / ${total}`;
  document.querySelector("#progress-bar").style.width = `${(count / total) * 100}%`;
}

function gradeQuiz(event) {
  event.preventDefault();
  graded = true;
  const selected = Object.fromEntries(new FormData(quizForm));
  let correct = 0;
  let wrong = 0;
  let empty = 0;

  const originalQuestions = currentLecture.questions.filter(hasChoices);
  originalQuestions.forEach((question) => {
    const card = document.querySelector(`#question-${question.id}`);
    const answer = selected[questionKey(question)];
    card.classList.remove("is-correct", "is-wrong", "is-empty");
    card.querySelectorAll(".option").forEach((option) => {
      const input = option.querySelector("input");
      option.classList.toggle("correct-answer", input.value === question.answer);
      option.classList.toggle("wrong-answer", Boolean(answer) && input.checked && input.value !== question.answer);
      input.disabled = true;
    });
    card.querySelector(".answer-note")?.remove();

    if (!answer) {
      empty++;
      card.classList.add("is-empty");
      card.insertAdjacentHTML("beforeend", `<p class="answer-note">بدون إجابة · الإجابة الصحيحة: <strong>${escapeHtml(question.answer)}</strong></p>`);
    } else if (normalizeAnswer(answer) === normalizeAnswer(question.answer)) {
      correct++;
      card.classList.add("is-correct");
    } else {
      wrong++;
      card.classList.add("is-wrong");
      card.insertAdjacentHTML("beforeend", `<p class="answer-note">إجابتك كانت: <strong>${escapeHtml(answer)}</strong> · الصحيحة: <strong>${escapeHtml(question.answer)}</strong></p>`);
    }
  });

  const percent = Math.round((correct / originalQuestions.length) * 100);
  document.querySelector("#score-percent").textContent = `${percent}%`;
  document.querySelector("#correct-count").textContent = correct;
  document.querySelector("#wrong-count").textContent = wrong;
  document.querySelector("#empty-count").textContent = empty;
  document.querySelector("#result-title").textContent = percent >= 85 ? "شغل ممتاز!" : percent >= 60 ? "نتيجة كويسة!" : "راجعها مرة كمان";
  issueIndex = 0;
  issueNav.classList.toggle("is-hidden", wrong + empty === 0);
  updateIssuePosition();
  resultOverlay.classList.remove("is-hidden");
}

function clearAnswers() {
  if (!currentLecture) return;
  localStorage.removeItem(storageKey(currentLecture.id));
  graded = false;
  issueNav.classList.add("is-hidden");
  renderQuestions();
  renderLectureCards();
  renderExamCards();
}

function reviewWrong() {
  resultOverlay.classList.add("is-hidden");
  issueIndex = 0;
  goToIssue();
}

function getIssues() {
  return [...document.querySelectorAll(".question-card.is-wrong, .question-card.is-empty")];
}

function updateIssuePosition() {
  const issues = getIssues();
  if (!issues.length) return;
  issuePosition.textContent = `${issueIndex + 1} / ${issues.length}`;
}

function goToIssue(direction = 0) {
  const issues = getIssues();
  if (!issues.length) return;
  issueIndex = (issueIndex + direction + issues.length) % issues.length;
  updateIssuePosition();
  issues[issueIndex].scrollIntoView({ behavior: "smooth", block: "center" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeAnswer(value) {
  return String(value)
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

lectureGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-lecture]");
  if (card) openQuiz(card.dataset.lecture);
});
examGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-quiz]");
  if (card) openQuiz(card.dataset.quiz);
});
quizForm.addEventListener("change", () => { if (!graded) saveAnswers(); });
quizForm.addEventListener("submit", gradeQuiz);
document.querySelector("#back-button").addEventListener("click", () => history.back());
document.querySelector("#home-button").addEventListener("click", () => { if (currentLecture) history.back(); });
document.querySelector("#clear-answers").addEventListener("click", clearAnswers);
document.querySelector("#close-result").addEventListener("click", () => resultOverlay.classList.add("is-hidden"));
document.querySelector("#review-wrong").addEventListener("click", reviewWrong);
document.querySelector("#previous-issue").addEventListener("click", () => goToIssue(-1));
document.querySelector("#next-issue").addEventListener("click", () => goToIssue(1));
resultOverlay.addEventListener("click", (event) => { if (event.target === resultOverlay) resultOverlay.classList.add("is-hidden"); });
window.addEventListener("scroll", () => {
  const currentScrollY = window.scrollY;
  const scrollingDown = currentScrollY > lastScrollY;

  if (currentScrollY < 80 || !scrollingDown) {
    topbar.classList.remove("is-scroll-hidden");
  } else if (currentScrollY - lastScrollY > 4) {
    topbar.classList.add("is-scroll-hidden");
  }

  lastScrollY = currentScrollY;
}, { passive: true });

history.replaceState({ screen: "home" }, "", window.location.pathname + window.location.search);

window.addEventListener("popstate", (e) => {
  if (e.state?.screen === "quiz") {
    openQuiz(e.state.id, false);
  } else {
    showHome();
  }
});

const hashLecture = window.location.hash.slice(1);
if (hashLecture && allQuizzes.some((quiz) => quiz.id === hashLecture)) {
  openQuiz(hashLecture, true);
}

const totalQuestions = quizData.reduce(
  (sum, lecture) => sum + lecture.questions.filter(hasChoices).length,
  0,
);
document.querySelector("#total-question-count").textContent = totalQuestions;
document.querySelector("#hero-question-count").textContent = totalQuestions;
renderLectureCards();
renderExamCards();
