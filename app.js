const quizData = window.QUIZ_DATA || [];
const welcomeScreen = document.querySelector("#welcome-screen");
const lectureSection = document.querySelector("#lecture-section");
const lectureGrid = document.querySelector("#lecture-grid");
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

const storageKey = (lectureId) => `research-quiz:${lectureId}`;
const getSaved = (lectureId) => JSON.parse(localStorage.getItem(storageKey(lectureId)) || "{}");
const saveAnswers = () => {
  if (!currentLecture) return;
  const answers = {};
  new FormData(quizForm).forEach((value, key) => { answers[key] = value; });
  localStorage.setItem(storageKey(currentLecture.id), JSON.stringify(answers));
  updateProgress();
  renderLectureCards();
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
    const originalQuestions = lecture.questions.filter((question) => Array.isArray(question.choices) && question.choices.length > 1);
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

function renderQuestions() {
  const saved = getSaved(currentLecture.id);
  const originalQuestions = currentLecture.questions.filter((question) => Array.isArray(question.choices) && question.choices.length > 1);
  questionList.innerHTML = originalQuestions.map((question, index) => {
    const options = getOptions(question);
    return `
      <article class="question-card" id="question-${question.id}" data-answer="${escapeHtml(question.answer)}">
        <span class="question-number">سؤال ${question.id}</span>
        <h3>${escapeHtml(question.question)}</h3>
        <div class="options">
          ${options.map((option) => `
            <label class="option">
              <input type="radio" name="q-${question.id}" value="${escapeHtml(option)}" ${saved[`q-${question.id}`] === option ? "checked" : ""} />
              <span>${escapeHtml(option)}</span>
            </label>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
  updateProgress();
}

function openLecture(lectureId, push = true) {
  currentLecture = quizData.find((lecture) => lecture.id === lectureId);
  graded = false;
  issueNav.classList.add("is-hidden");
  topbar.classList.remove("is-scroll-hidden");
  document.querySelector("#quiz-title").textContent = currentLecture.title;
  document.querySelector("#quiz-file-name").textContent = currentLecture.fileName;
  welcomeScreen.classList.add("is-hidden");
  lectureSection.classList.add("is-hidden");
  quizScreen.classList.remove("is-hidden");
  topbarTotal.classList.add("is-hidden");
  topbarProgress.classList.remove("is-hidden");
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (push) history.pushState({ screen: "quiz", id: lectureId }, "", "#" + lectureId);
}

function showHome() {
  currentLecture = null;
  graded = false;
  issueNav.classList.add("is-hidden");
  topbar.classList.remove("is-scroll-hidden");
  quizScreen.classList.add("is-hidden");
  welcomeScreen.classList.remove("is-hidden");
  lectureSection.classList.remove("is-hidden");
  resultOverlay.classList.add("is-hidden");
  topbarProgress.classList.add("is-hidden");
  topbarTotal.classList.remove("is-hidden");
  renderLectureCards();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateProgress() {
  if (!currentLecture) return;
  const answered = new FormData(quizForm).keys();
  const count = [...answered].length;
  const total = currentLecture.questions.filter((question) => Array.isArray(question.choices) && question.choices.length > 1).length;
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

  const originalQuestions = currentLecture.questions.filter((question) => Array.isArray(question.choices) && question.choices.length > 1);
  originalQuestions.forEach((question) => {
    const card = document.querySelector(`#question-${question.id}`);
    const answer = selected[`q-${question.id}`];
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
  if (card) openLecture(card.dataset.lecture);
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
    openLecture(e.state.id, false);
  } else {
    showHome();
  }
});

const hashLecture = window.location.hash.slice(1);
if (hashLecture && quizData.some((l) => l.id === hashLecture)) {
  openLecture(hashLecture, true);
}

const totalQuestions = quizData.reduce(
  (sum, lecture) => sum + lecture.questions.filter((question) => Array.isArray(question.choices) && question.choices.length > 1).length,
  0,
);
document.querySelector("#total-question-count").textContent = totalQuestions;
document.querySelector("#hero-question-count").textContent = totalQuestions;
renderLectureCards();
