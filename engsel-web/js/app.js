const CATEGORIES = [
  { id: "textbook", label: "교과서", description: "학교에서 배우는 교과서 본문" },
  { id: "supplement", label: "부교재", description: "부교재와 추가 학습 자료" },
  { id: "mock-exam", label: "모의고사", description: "모의고사 지문과 문제" },
];

const FEATURES = [
  { href: "/passage", title: "본문", detail: "텍스트를 직접 입력하거나 본문 이미지를 올리면 글자를 읽어 옵니다. 확인한 뒤 본문을 저장합니다." },
  { href: "/notes", title: "학습 노트", detail: "수정할 수 있는 디지털 노트에 필기와 한국어 정리, 오답을 쌓아 두고 나중에 다시 봅니다." },
  { href: "/quiz", title: "문제 풀이", detail: "생성된 문제를 컴퓨터에서 풀고, 정답의 근거가 된 원문 문장과 출제 이유를 함께 확인합니다." },
  { href: "/rewrite", title: "한국어 정리", detail: "영어 본문을 자기만의 한국어로 다시 적고, 잘못 이해한 부분을 피드백으로 확인합니다." },
  { href: "/plan", title: "학습 계획", detail: "시험 날짜를 입력하면 남은 기간을 고려해 하루 학습 범위를 정합니다." },
  { href: "/assistant", title: "도우미", detail: "본문과 문제를 보다가 궁금한 점이 생기면 앱 안의 도우미에게 도움을 요청합니다." },
];

const QUIZ_TABS = [
  { href: "/quiz", label: "해석", description: "업로드한 영어 본문을 문장별로 나누고, 한글 해석과 나란히 비교합니다." },
  { href: "/quiz/grammar", label: "어법 고르기", description: "본문에서 내신에 자주 나오는 어법 부분을 고르거나 고칩니다." },
  { href: "/quiz/vocabulary", label: "어휘 고르기", description: "본문 맥락에 맞는 단어와 숙어를 객관식이나 빈칸으로 고릅니다." },
  { href: "/quiz/order", label: "문장 배열", description: "흐트러진 문장을 글의 흐름에 맞게 다시 배열합니다." },
  { href: "/quiz/insert", label: "문장 삽입", description: "주어진 문장이 들어갈 위치를 고릅니다." },
  { href: "/quiz/written", label: "서술형", description: "본문으로 영작과 요약을 쓰고, 모범 답안과 비교한 피드백을 받습니다." },
  { href: "/quiz/wordbook", label: "단어장", description: "모르거나 틀린 단어를 모아 나만의 단어장으로 정리합니다." },
];

const NOTICE = "먼저 공부할 카테고리(교과서/부교재/모의고사)를 선택해주세요";
const STUDIES_KEY = "engsel.category-studies";
const PASSAGES_KEY = "engsel.passages";
const ACTIVE_PASSAGE_KEY = "engsel.active-passage";
const ACTIVE_CATEGORY_KEY = "engsel.active-category";
const STUDY_NOTES_KEY = "engsel.passage-notes";
const MARKS_KEY = "engsel.passage-marks";
const ERASER_MODE_KEY = "engsel.eraser-mode";
const MEMO_DISPLAY_KEY = "engsel.memo-display";
const PRACTICE_KEY = "engsel.sentence-practice";
const WORDBOOK_KEY = "engsel.wordbook";
const FLOW_KEY = "engsel.flow-notes";
const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

const draft = {
  mode: "text",
  categoryId: "textbook",
  title: "",
  textBody: "",
  imageBody: "",
  editingId: null,
  message: "",
  messageTone: "info",
  previewUrl: "",
  imageName: "",
  imageOpen: false,
  ocrState: "idle",
  file: null,
};

const assistantState = { open: false, messages: [], pending: false };
let toastTimer = 0;
let clockTimer = 0;
let lastPath = "";
let ocrToken = 0;
let savedImageReview = null;
let imageEditHintId = "";
const passageImageUrls = new Map();

const embedded = new URLSearchParams(location.search).get("embed") === "1";
if (embedded) document.documentElement.dataset.embed = "embed";
const headerEl = document.querySelector("#site-header");
const viewEl = document.querySelector("#view");
const toastEl = document.querySelector("#toast");
const assistantEl = document.querySelector("#assistant");
const assistantPanel = document.querySelector("#assistant-panel");
const assistantLog = document.querySelector("#assistant-log");
const assistantToggle = document.querySelector("#assistant-toggle");
const assistantForm = document.querySelector("#assistant-form");
const assistantQuestion = document.querySelector("#assistant-question");
const assistantSend = document.querySelector("#assistant-send");
const selectToolbar = document.querySelector("#select-toolbar");
const memoPopover = document.querySelector("#memo-popover");
const memoInput = document.querySelector("#memo-input");
const notePopover = document.querySelector("#note-popover");
const notePopoverText = document.querySelector("#note-popover-text");
const notePopoverActions = document.querySelector("#note-popover-actions");
const noteActions = document.querySelector("#note-actions");
let activeSelection = null;
let memoDraft = null;
let noteTarget = null;
let eraserOn = false;
let eraserMode = localStorage.getItem(ERASER_MODE_KEY) === "sentence" ? "sentence" : "word";
let flowPassageId = "";
let flowView = [];
let flowToken = 0;
let flowPending = null;
let flowPendingGroups = null;
let memoDisplay = localStorage.getItem(MEMO_DISPLAY_KEY) === "inline" ? "inline" : "click";
let selectedMemoColor = "#FFE066";
let selectedMemoStyle = "box";
let memoPreviewSignature = "";
let memoPreviewRoot = null;
let memoPreviewRestore = null;
let pendingSelectionRestore = null;
const MEMO_PREVIEW_ID = "__engsel_memo_preview__";
let penEdit = null;
let toolbarPaneTimer = 0;
const annotationUndo = [];
const ANNOTATION_UNDO_LIMIT = 100;
const MEMO_COLORS = {
  yellow: { swatch: "#fde047", note: "#fef9c3", ink: "#713f12", line: "#ca8a04" },
  lime: { swatch: "#bef264", note: "#ecfccb", ink: "#365314", line: "#65a30d" },
  sky: { swatch: "#7dd3fc", note: "#e0f2fe", ink: "#0c4a6e", line: "#0284c7" },
  green: { swatch: "#86efac", note: "#dcfce7", ink: "#14532d", line: "#16a34a" },
  blue: { swatch: "#93c5fd", note: "#dbeafe", ink: "#1e3a8a", line: "#2563eb" },
  pink: { swatch: "#f9a8d4", note: "#fce7f3", ink: "#831843", line: "#db2777" },
  purple: { swatch: "#d8b4fe", note: "#f3e8ff", ink: "#581c87", line: "#9333ea" },
  red: { swatch: "#f87171", note: "#fee2e2", ink: "#991b1b", line: "#dc2626" },
  orange: { swatch: "#f87171", note: "#fee2e2", ink: "#991b1b", line: "#dc2626" },
};
const PEN_COLORS = ["yellow", "lime", "sky", "pink", "purple"];
const EMPHASIS_COLORS = [
  { hex: "#FFE066", label: "노랑" },
  { hex: "#FF6B6B", label: "빨강" },
  { hex: "#22C55E", label: "초록" },
  { hex: "#3B82F6", label: "파랑" },
  { hex: "#A855F7", label: "보라" },
];
const emphasisColors = document.querySelector("#emphasis-colors");
const memoStyles = document.querySelector("#memo-styles");
let practiceItems = [];
let practicePassageId = "";
let practiceToken = 0;
let wordbookItems = [];
let wordbookPassageId = "";
let wordbookHideMeanings = true;
let wordbookFilter = "all";
let wordbookToken = 0;
const wordLookupInflight = new Set();
let vocabPassageId = "";
let vocabBody = "";
let vocabItems = [];
let vocabFallbackItems = [];
let vocabPicks = {};
let vocabGraded = false;
let vocabQuizToken = 0;
let vocabQuizState = "";
let vocabQuizMessage = "";
let vocabDraftPending = false;
let grammarPassageId = "";
let grammarBody = "";
let grammarItems = [];
let grammarFallbackItems = [];
let grammarPicks = {};
let grammarGraded = false;
let grammarQuizToken = 0;
let grammarQuizState = "";
let grammarQuizMessage = "";
let grammarDraftPending = false;
const quizDraftInflight = new Set();
let orderPassageId = "";
let orderBody = "";
let orderItems = [];
let orderPicks = {};
let orderGraded = false;
let insertPassageId = "";
let insertBody = "";
let insertItems = [];
let insertPicks = {};
let insertGraded = false;
let writtenPassageId = "";
let writtenBody = "";
let writtenItems = [];
let writtenAnswers = [];
let writtenFeedback = [];
let writtenState = "";
let writtenMessage = "";
let writtenSource = "";
let writtenToken = 0;
let writtenPending = false;
let writtenBusy = -1;
const writtenInflight = new Set();
let explainQuiz = "";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isCategory(id) {
  return CATEGORIES.some((item) => item.id === id);
}

function categoryById(id) {
  return CATEGORIES.find((item) => item.id === id) || null;
}

function currentPath() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  return path.startsWith("/") ? path : `/${path}`;
}

function isLearning(path) {
  return FEATURES.some((item) => path === item.href || path.startsWith(`${item.href}/`));
}

function loadStudies() {
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem(STUDIES_KEY) || "[]");
  } catch {
    stored = [];
  }
  return CATEGORIES.map((category) => {
    const found = Array.isArray(stored) ? stored.find((item) => item.categoryId === category.id) : null;
    return {
      categoryId: category.id,
      examDate: found?.examDate || null,
      progress: Number.isFinite(found?.progress) ? found.progress : 0,
      note: typeof found?.note === "string" ? found.note : "",
    };
  });
}

function saveStudies(studies) {
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
}

function loadPassages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PASSAGES_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string" && typeof item.body === "string")
      .map((item) => ({
        id: item.id,
        title: typeof item.title === "string" ? item.title : "제목 없는 본문",
        body: item.body,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        categoryId: isCategory(item.categoryId) ? item.categoryId : "textbook",
        imageName: typeof item.imageName === "string" ? item.imageName : "",
      }));
  } catch {
    return [];
  }
}

function savePassages(passages) {
  localStorage.setItem(PASSAGES_KEY, JSON.stringify(passages));
}

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("engsel-images", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function imageRequest(mode, run) {
  return openImageDb().then((db) => new Promise((resolve, reject) => {
    const request = run(db.transaction("images", mode).objectStore("images"));
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  }));
}

function putPassageImage(id, file, name) {
  return imageRequest("readwrite", (store) => store.put({ blob: file, name }, id));
}

function getPassageImage(id) {
  return imageRequest("readonly", (store) => store.get(id));
}

function deletePassageImage(id) {
  return imageRequest("readwrite", (store) => store.delete(id));
}

function rememberPassageImage(id, file) {
  const previous = passageImageUrls.get(id);
  if (previous) URL.revokeObjectURL(previous);
  passageImageUrls.set(id, URL.createObjectURL(file));
}

function forgetPassageImage(id) {
  const previous = passageImageUrls.get(id);
  if (previous) URL.revokeObjectURL(previous);
  passageImageUrls.delete(id);
  deletePassageImage(id).catch(() => {});
}

function hydratePassageImages() {
  viewEl.querySelectorAll("[data-passage-image]").forEach((img) => {
    const id = img.dataset.passageImage;
    const cached = passageImageUrls.get(id);
    if (cached) {
      img.src = cached;
      return;
    }
    getPassageImage(id).then((record) => {
      if (!record?.blob) return;
      const previous = passageImageUrls.get(id);
      const url = previous || URL.createObjectURL(record.blob);
      if (!previous) passageImageUrls.set(id, url);
      viewEl.querySelectorAll(`[data-passage-image="${CSS.escape(id)}"]`).forEach((node) => {
        node.src = url;
      });
    }).catch(() => {});
  });
}

function activeCategory() {
  const stored = localStorage.getItem(ACTIVE_CATEGORY_KEY) || "";
  return isCategory(stored) ? stored : "";
}

function setActiveCategory(id) {
  if (id) localStorage.setItem(ACTIVE_CATEGORY_KEY, id);
  else localStorage.removeItem(ACTIVE_CATEGORY_KEY);
}

function activePassageId() {
  return localStorage.getItem(ACTIVE_PASSAGE_KEY) || "";
}

function setActivePassage(id) {
  if (id) localStorage.setItem(ACTIVE_PASSAGE_KEY, id);
  else localStorage.removeItem(ACTIVE_PASSAGE_KEY);
}

function activePassage() {
  return loadPassages().find((item) => item.id === activePassageId()) || null;
}

function loadStudyNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STUDY_NOTES_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function studyNote(passageId) {
  const note = loadStudyNotes()[passageId];
  return typeof note === "string" ? note : "";
}

function saveStudyNote(passageId, text) {
  const notes = loadStudyNotes();
  notes[passageId] = text;
  localStorage.setItem(STUDY_NOTES_KEY, JSON.stringify(notes));
}

function removeStudyNote(passageId) {
  const notes = loadStudyNotes();
  if (!Object.prototype.hasOwnProperty.call(notes, passageId)) return;
  delete notes[passageId];
  localStorage.setItem(STUDY_NOTES_KEY, JSON.stringify(notes));
}

function parseLocalDate(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getDDay(examDate, now) {
  const exam = parseLocalDate(examDate);
  if (!exam) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((exam.getTime() - today.getTime()) / 86400000);
  if (daysLeft === 0) return "D-Day";
  if (daysLeft > 0) return `D-${daysLeft}`;
  return `D+${Math.abs(daysLeft)}`;
}

function formatCountdown(examDate, now) {
  const exam = parseLocalDate(examDate);
  if (!exam) return "시험일을 확인해 주세요.";
  const deadline = new Date(exam.getFullYear(), exam.getMonth(), exam.getDate(), 23, 59, 59);
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "시험일이 지났습니다.";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}

function showToast(message) {
  toastEl.hidden = false;
  toastEl.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

function showNotice() {
  showToast(NOTICE);
}

function go(path) {
  const next = `#${path}`;
  if (location.hash === next) render();
  else location.hash = path;
}

function draftBody() {
  return draft.mode === "text" ? draft.textBody : draft.imageBody;
}

function clearDraft() {
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  draft.mode = "text";
  draft.title = "";
  draft.textBody = "";
  draft.imageBody = "";
  draft.editingId = null;
  draft.message = "";
  draft.previewUrl = "";
  draft.imageName = "";
  draft.imageOpen = false;
  draft.ocrState = "idle";
  draft.file = null;
  ocrToken += 1;
}

function navClass(path, href) {
  const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  return active ? "is-active" : "";
}

function quizMenu(path) {
  const items = QUIZ_TABS.map((tab) => {
    const current = path === tab.href ? ' aria-current="page"' : "";
    return `<a href="#${tab.href}" role="menuitem"${current}>${esc(tab.label)}</a>`;
  }).join("");
  return `
    <div class="nav-menu">
      <span class="nav-parent ${navClass(path, "/quiz")}" tabindex="0" aria-haspopup="menu">문제 풀이</span>
      <div class="nav-drop" role="menu" aria-label="문제 유형">
        <div class="nav-drop-list">${items}</div>
      </div>
    </div>
  `;
}

function renderHeader(path, categoryId) {
  if (embedded) {
    headerEl.hidden = true;
    headerEl.innerHTML = "";
    assistantEl.hidden = true;
    return;
  }
  const category = categoryById(categoryId);
  const unlocked = Boolean(category) && path !== "/";
  const links = FEATURES.filter((feature) => feature.href !== "/assistant" && feature.href !== "/plan").map((feature) => {
    const className = `${navClass(path, feature.href)}${unlocked ? "" : " is-locked"}`;
    if (!unlocked) {
      return `<button type="button" class="${className}" data-action="locked-nav">${esc(feature.title)}</button>`;
    }
    if (feature.href === "/quiz") return quizMenu(path);
    return `<a class="${className}" href="#${feature.href}">${esc(feature.title)}</a>`;
  }).join("");
  const crumb = category && path !== "/"
    ? `<span aria-hidden="true">›</span><a class="${path.startsWith("/study/") ? "current" : ""}" href="#/study/${category.id}">[${esc(category.label)}]</a>`
    : "";

  headerEl.innerHTML = `
    <div class="header">
      <div class="wrap header-inner">
        <div class="brand">
          <a href="#/">EngSel 엥셀</a>
          ${crumb}
        </div>
        <nav class="nav" aria-label="주요 메뉴">
          <a class="${navClass(path, "/")}" href="#/">홈</a>
          ${links}
        </nav>
      </div>
    </div>
  `;
}

function renderHome() {
  const studies = loadStudies();
  const now = new Date();
  const cards = CATEGORIES.map((category) => {
    const study = studies.find((item) => item.categoryId === category.id);
    const label = study?.examDate ? getDDay(study.examDate, now) || "시험일 미정" : "시험일 미정";
    return `
      <a class="card category-card" href="#/study/${category.id}">
        <div>
          <h2>${esc(category.label)}</h2>
          <p>${esc(category.description)}</p>
        </div>
        <div class="category-meta">
          <strong>${esc(label)}</strong>
          <span>${study?.progress ?? 0}%</span>
        </div>
      </a>
    `;
  }).join("");

  viewEl.innerHTML = `
    <div class="wrap page">
      <p class="kicker">혼자 준비하는 영어 내신</p>
      <h1>EngSel 엥셀</h1>
      <p class="lead">교과서, 부교재, 모의고사 중에서 공부할 자료를 고르세요.</p>
      <section class="cards" aria-label="학습 카테고리">${cards}</section>
    </div>
  `;
  document.title = "EngSel 엥셀";
}

function renderStudy(categoryId) {
  const category = categoryById(categoryId);
  const study = loadStudies().find((item) => item.categoryId === categoryId);
  if (!category || !study) {
    go("/");
    return;
  }
  const now = new Date();
  const dday = study.examDate ? getDDay(study.examDate, now) : "시험일 미정";
  const countdown = study.examDate ? formatCountdown(study.examDate, now) : "시험일을 정하면 남은 시간이 표시됩니다.";
  viewEl.innerHTML = `
    <div class="wrap page stack">
      <div>
        <a class="kicker" href="#/">전체 카테고리</a>
        <h1>${esc(category.label)}</h1>
        <p class="lead">${esc(category.description)}</p>
      </div>
      <section class="panel">
        <div class="exam-row">
          <div>
            <p class="exam-label">시험 D-Day</p>
            <p class="dday" data-live="dday">${esc(dday || "시험일 미정")}</p>
            <p class="lead" data-live="countdown">${esc(countdown)}</p>
          </div>
          <label class="field">시험일
            <input data-field="exam-date" type="date" value="${esc(study.examDate || "")}">
          </label>
        </div>
        <div class="progress-label" style="margin-top:3mm">
          <span>학습 달성도</span>
          <strong>${study.progress}%</strong>
        </div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${study.progress}" aria-label="학습 달성도">
          <span style="width:${study.progress}%"></span>
        </div>
      </section>
      <section class="panel">
        <label class="field" for="category-note">나를 위한 한마디
          <textarea id="category-note" data-field="note" rows="5" placeholder="오늘 나에게 남기고 싶은 말을 적어 보세요."></textarea>
        </label>
      </section>
    </div>
  `;
  const note = viewEl.querySelector("#category-note");
  if (note) note.value = study.note;
  document.title = `${category.label} · EngSel 엥셀`;
}

function passagePicker(categoryId) {
  const passages = loadPassages().filter((item) => item.categoryId === categoryId);
  const category = categoryById(categoryId);
  if (!passages.length) {
    return `
      <section class="panel dashed">
        <p class="kicker">본문 선택</p>
        <p class="lead">${esc(category?.label || "이 카테고리")}에 저장된 본문이 없습니다. 본문 탭에서 글을 저장한 뒤 여기서 고를 수 있습니다.</p>
        <a class="kicker" href="#/passage">본문 등록하기</a>
      </section>
    `;
  }
  const selectedId = activePassageId();
  return `
    <section class="panel picker">
      <div class="between">
        <p class="kicker">본문 선택</p>
        <p class="tiny">${esc(category?.label || "")} · ${passages.length}개</p>
      </div>
      <div class="picker-list" role="listbox" aria-label="공부할 본문">
        ${passages.map((passage) => {
          const selected = passage.id === selectedId;
          return `
            <button type="button" class="picker-item${selected ? " is-selected" : ""}" role="option" aria-selected="${selected}" data-action="pick-passage" data-id="${esc(passage.id)}">
              <strong>${esc(passage.title)}</strong>
              ${selected ? '<span class="kicker">선택됨</span>' : ""}
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function loadMarks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MARKS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMarkStore(store) {
  localStorage.setItem(MARKS_KEY, JSON.stringify(store));
}

function tidyPiece(text, start, end) {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from])) from += 1;
  while (to > from && /\s/.test(text[to - 1])) to -= 1;
  if (from >= to) return null;
  if (!/[A-Za-z0-9]/.test(text.slice(from, to))) return null;
  return [from, to];
}

function marksFor(passageId) {
  const list = loadMarks()[passageId];
  if (!Array.isArray(list)) return [];
  const text = loadPassages().find((item) => item.id === passageId)?.body || "";
  return list.flatMap((mark) => {
    if (!Number.isInteger(mark.start) || !Number.isInteger(mark.end) || mark.end <= mark.start) return [];
    const kept = tidyPiece(text, mark.start, Math.min(mark.end, text.length));
    return kept ? [{ ...mark, start: kept[0], end: kept[1] }] : [];
  });
}

function memoColor(id) {
  return Object.prototype.hasOwnProperty.call(MEMO_COLORS, id) ? id : "yellow";
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function storedColor(value) {
  if (isHexColor(value)) return value.toUpperCase();
  return memoColor(value);
}

function emphasisHex(value) {
  if (isHexColor(value)) {
    const hex = value.toUpperCase();
    if (EMPHASIS_COLORS.some((item) => item.hex === hex)) return hex;
  }
  const named = {
    yellow: "#FFE066",
    orange: "#FF6B6B",
    red: "#FF6B6B",
    green: "#22C55E",
    lime: "#22C55E",
    blue: "#3B82F6",
    sky: "#3B82F6",
    purple: "#A855F7",
    pink: "#A855F7",
  };
  return named[value] || "#FFE066";
}

function mixHex(hex, target, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((channel, index) => (
    Math.round(channel + (target[index] - channel) * amount)
  ));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function colorParts(value) {
  if (isHexColor(value)) {
    const hex = value.toUpperCase();
    return { swatch: hex, note: mixHex(hex, [255, 255, 255], 0.78), ink: mixHex(hex, [0, 0, 0], 0.55), line: hex };
  }
  return MEMO_COLORS[memoColor(value)];
}

function memoStyle(id, allowEmpty = false) {
  if (id === "box" || id === "fill" || id === "solid" || id === "wave") return id;
  return allowEmpty ? "" : "fill";
}

function colorStyle(id) {
  const color = colorParts(id);
  const onLine = relativeLuminance(color.line) > 0.62 ? color.ink : "#ffffff";
  return `--memo-swatch:${color.swatch};--memo-note:${color.note};--memo-ink:${color.ink};--memo-line:${color.line};--memo-on-line:${onLine}`;
}

function relativeLuminance(hex) {
  const value = isHexColor(hex) ? hex : "#000000";
  const n = parseInt(value.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function wordsIn(value) {
  return String(value || "").match(/[A-Za-z0-9]+/g) || [];
}

function markScope(text, from, to) {
  if (!text || to <= from) return "word";
  const last = Math.max(text.length - 1, 0);
  const [start, end] = sentenceBounds(text, Math.min(Math.max(from, 0), last));
  const [otherStart, otherEnd] = sentenceBounds(text, Math.min(Math.max(to - 1, 0), last));
  if (start !== otherStart || end !== otherEnd) return "word";
  const sentenceWords = wordsIn(text.slice(start, end));
  const selectedWords = wordsIn(text.slice(Math.max(from, start), Math.min(to, end)));
  if (!sentenceWords.length || selectedWords.length < sentenceWords.length) return "word";
  return selectedWords.join(" ") === sentenceWords.join(" ") ? "sentence" : "word";
}

function scopeOf(text, mark) {
  if (mark.scope === "sentence" || mark.scope === "word") return mark.scope;
  return markScope(text, mark.start, mark.end);
}

function sentenceSpans(text) {
  const spans = [];
  let index = 0;
  while (index < text.length) {
    if (/\s/.test(text[index])) {
      let next = index + 1;
      while (next < text.length && /\s/.test(text[next])) next += 1;
      spans.push({ start: index, end: next, kind: "gap" });
      index = next;
      continue;
    }
    const [start, end] = sentenceBounds(text, index);
    const from = Math.min(Math.max(start, index), text.length);
    const to = Math.max(Math.min(end, text.length), from + 1);
    spans.push({ start: from, end: to, kind: "sentence" });
    index = to > index ? to : index + 1;
  }
  return spans;
}

function inlineNoteHtml(mark, scope) {
  const color = storedColor(mark.color);
  const label = scope === "sentence" ? "문장" : "단어";
  return `<span class="inline-note" data-inline-note="${esc(mark.id)}" data-scope="${scope}" data-color="${esc(color)}" style="${colorStyle(color)}" role="button" tabindex="0"><span class="inline-note-label">${label}</span>${esc(String(mark.note || "").trim())}</span>`;
}

function annotatedHtml(body, marks) {
  const text = String(body ?? "");
  return sentenceSpans(text).map((span) => (
    span.kind === "sentence" ? renderSentence(text, span.start, span.end, marks) : esc(text.slice(span.start, span.end))
  )).join("");
}

function renderSentence(text, from, to, marks) {
  const sentences = marks.filter((mark) => scopeOf(text, mark) === "sentence" && mark.start < to && mark.end > from);
  const words = marks.filter((mark) => scopeOf(text, mark) === "word" && mark.end > from && mark.start < to);
  const inner = renderWordLayer(text, from, to, words);
  if (!sentences.length) return inner;
  const sentence = sentences[sentences.length - 1];
  const color = storedColor(sentence.color);
  const style = markStyle(sentence, "sentence");
  const notes = memoDisplay === "inline"
    ? sentences.filter((mark) => String(mark.note || "").trim()).map((mark) => inlineNoteHtml(mark, "sentence")).join("")
    : "";
  const live = sentence.preview ? " is-memo-preview" : "";
  return `<span class="sentence-memo memo-anchor is-${style}${live}" data-mark="${esc(sentence.id)}" data-scope="sentence" data-style="${style}" data-color="${esc(color)}" style="${colorStyle(color)}">${inner}${notes}</span>`;
}

function markStyle(mark, scope = "") {
  if (mark?.style === "wave" || mark?.style === "solid" || mark?.style === "fill" || mark?.style === "box") return mark.style;
  if ((scope || mark?.scope) === "sentence") return "solid";
  return "fill";
}

function rangesOverlap(start, end, mark) {
  return mark.start < end && mark.end > start;
}

function wordsOverlap(marks) {
  const sorted = [...marks].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start < sorted[index - 1].end) return true;
  }
  return false;
}

function pickLayer(marks) {
  if (!marks.length) return null;
  const noted = marks.filter((mark) => String(mark.note || "").trim());
  const pool = noted.length ? noted : marks;
  return pool[pool.length - 1];
}

function waveImage(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="4" viewBox="0 0 12 4"><path d="M0 3 Q3 .6 6 3 T12 3" fill="none" stroke="${color}" stroke-width="1.35" stroke-linecap="round"/></svg>`;
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
}

function lineColor(mark) {
  return colorParts(mark?.color).line;
}

function fillSwatch(mark) {
  if (!mark) return "transparent";
  return colorParts(mark.color).swatch;
}

function cutMatching(marks, text, from, to, predicate) {
  const next = [];
  const push = (item, start, end) => {
    const kept = tidyPiece(text, start, end);
    if (kept) next.push({ ...item, start: kept[0], end: kept[1] });
  };
  marks.forEach((item) => {
    if (!predicate(item) || item.end <= from || item.start >= to) {
      next.push(item);
      return;
    }
    if (item.start < from) push(item, item.start, from);
    if (item.end > to) push({ ...item, id: crypto.randomUUID() }, to, item.end);
  });
  return next;
}

function renderWordLayer(text, from, to, words) {
  const local = words
    .map((mark) => ({
      ...mark,
      originStart: mark.start,
      start: Math.max(mark.start, from),
      end: Math.min(mark.end, to),
    }))
    .filter((mark) => mark.end > mark.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  if (wordsOverlap(local) || local.some((mark) => markStyle(mark) !== "fill")) {
    return renderLayeredWords(text, from, to, local);
  }
  let html = "";
  let cursor = from;
  local.forEach((mark) => {
    if (mark.start < cursor) return;
    html += esc(text.slice(cursor, mark.start));
    const hasNote = Boolean(String(mark.note || "").trim());
    const pieces = markedPieces(text, mark.start, mark.end, mark.id, hasNote, mark.color);
    const showNote = memoDisplay === "inline" && hasNote && mark.originStart >= from && mark.originStart < to;
    html += showNote
      ? `<span class="memo-anchor" data-scope="word">${pieces}${inlineNoteHtml(mark, "word")}</span>`
      : pieces;
    cursor = mark.end;
  });
  html += esc(text.slice(cursor, to));
  return html;
}

function sliceLayers(start, end, local) {
  const covering = local.filter((mark) => mark.start <= start && mark.end >= end);
  const fill = covering
    .filter((mark) => markStyle(mark) === "fill")
    .sort((a, b) => a.start - b.start || a.end - b.end)[0] || null;
  const solid = pickLayer(covering.filter((mark) => markStyle(mark) === "solid"));
  const wave = pickLayer(covering.filter((mark) => markStyle(mark) === "wave"));
  const box = pickLayer(covering.filter((mark) => markStyle(mark) === "box"));
  return { start, end, covering, fill, solid, wave, box, primary: solid || wave || box || fill };
}

function sliceNotes(slice, seenNotes, from, to) {
  const notes = [];
  slice.covering.forEach((mark) => {
    if (seenNotes.has(mark.id) || slice.start !== mark.start) return;
    seenNotes.add(mark.id);
    if (memoDisplay === "inline" && String(mark.note || "").trim() && mark.originStart >= from && mark.originStart < to) {
      notes.push(inlineNoteHtml(mark, "word"));
    }
  });
  return notes;
}

function sliceBody(text, slice) {
  const { start, end, fill, solid, wave, primary, covering } = slice;
  if (!primary || (!solid && !wave && !fill)) return esc(text.slice(start, end));
  return markedPieces(text, start, end, primary.id, Boolean(String(primary.note || "").trim()), primary.color, {
    fill,
    wave,
    solid,
    covering: covering.filter((mark) => markStyle(mark) !== "box"),
  });
}

function unifiedBox(mark, inner, covering) {
  const live = mark.preview ? " is-memo-preview" : "";
  const noted = String(mark.note || "").trim() ? " word-memo" : "";
  const stack = [...new Set(covering.map((item) => item.id).filter((id) => id && id !== mark.id))];
  const stackAttr = stack.length ? ` data-stack="${esc(stack.join(","))}"` : "";
  return `<mark class="pen box word-box${live}${noted}" data-mark="${esc(mark.id)}" data-scope="word" data-style="box" data-color="${esc(storedColor(mark.color))}" style="${colorStyle(mark.color)}"${stackAttr}>${inner}</mark>`;
}

function withWordNotes(body, notes) {
  return notes.length ? `<span class="memo-anchor" data-scope="word">${body}${notes.join("")}</span>` : body;
}

function renderLayeredWords(text, from, to, local) {
  const points = new Set([from, to]);
  local.forEach((mark) => {
    points.add(mark.start);
    points.add(mark.end);
  });
  const cuts = [...points].filter((point) => point >= from && point <= to).sort((a, b) => a - b);
  const slices = [];
  for (let index = 0; index < cuts.length - 1; index += 1) {
    slices.push(sliceLayers(cuts[index], cuts[index + 1], local));
  }
  const seenNotes = new Set();
  let html = "";
  let index = 0;
  while (index < slices.length) {
    const slice = slices[index];
    if (!slice.box) {
      html += withWordNotes(sliceBody(text, slice), sliceNotes(slice, seenNotes, from, to));
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < slices.length && slices[end].box?.id === slice.box.id && slices[end].start === slices[end - 1].end) end += 1;
    const group = slices.slice(index, end);
    const covering = group.flatMap((item) => item.covering);
    const notes = group.flatMap((item) => sliceNotes(item, seenNotes, from, to));
    html += withWordNotes(unifiedBox(slice.box, group.map((item) => sliceBody(text, item)).join(""), covering), notes);
    index = end;
  }
  return html;
}

function markedPieces(text, start, end, id, noted, color, layer) {
  let html = "";
  let index = start;
  while (index < end) {
    if (/\s/.test(text[index])) {
      let next = index + 1;
      while (next < end && /\s/.test(text[next])) next += 1;
      html += esc(text.slice(index, next));
      index = next;
      continue;
    }
    let next = index + 1;
    while (next < end && !/\s/.test(text[next])) next += 1;
    const token = text.slice(index, next);
    if (/[A-Za-z0-9]/.test(token)) html += markHtml(token, id, noted, color, layer);
    else html += esc(token);
    index = next;
  }
  return html;
}

function markHtml(token, id, noted, color, layer) {
  const wave = layer?.wave;
  const solid = layer?.solid;
  const box = layer?.box;
  const fill = layer?.fill;
  const primaryId = solid?.id || wave?.id || box?.id || id;
  const stack = [...new Set((layer?.covering || []).map((mark) => mark.id).filter((markId) => markId && markId !== primaryId))];
  const stackAttr = stack.length ? ` data-stack="${esc(stack.join(","))}"` : "";
  const live = [wave, solid, box, fill].some((mark) => mark?.preview) ? " is-memo-preview" : "";
  if (wave || solid) {
    const painted = solid || wave;
    let style = `${colorStyle(painted.color)};--fill-swatch:${fillSwatch(fill)}`;
    if (solid) style += `;--solid-line:${lineColor(solid)}`;
    if (wave && solid) style += `;--wave-image:${waveImage(lineColor(wave))}`;
    const underlay = fill ? ` data-underlay="${esc(fill.id)}"` : "";
    const tone = `pen${live}${wave ? " wave" : ""}${solid ? " solid" : ""}${box ? " box" : ""}`;
    return `<mark class="${tone}" data-mark="${esc(primaryId)}" data-color="${esc(storedColor(painted.color))}" style="${style}"${underlay}${stackAttr}>${esc(token)}</mark>`;
  }
  if (box) {
    const tone = `pen box${live}${noted ? " word-memo" : ""}`;
    return `<mark class="${tone}" data-mark="${esc(box.id)}" data-color="${esc(storedColor(box.color))}" style="${colorStyle(box.color)}"${stackAttr}>${esc(token)}</mark>`;
  }
  const tone = `pen${live}${noted ? " word-memo" : ""}`;
  return `<mark class="${tone}" data-mark="${esc(id)}" data-color="${esc(storedColor(color))}" style="${colorStyle(color)}"${stackAttr}>${esc(token)}</mark>`;
}

function styleLabel(mark) {
  const style = markStyle(mark);
  if (style === "box") return "네모박스";
  if (style === "wave") return "물결";
  if (style === "solid") return "실선";
  return "형광펜";
}

function paintAnnotations(root) {
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  if (!passage) return;
  const top = root.scrollTop;
  const left = root.scrollLeft;
  root.innerHTML = annotatedHtml(passage.body, marksWithMemoPreview(passage.id));
  root.scrollTop = top;
  root.scrollLeft = left;
  placeInlineNotes();
}

function textLineRects(anchor) {
  const rects = [];
  const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest(".inline-note")) return NodeFilter.FILTER_REJECT;
      return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) {
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    rects.push(...range.getClientRects());
  }
  return rects.filter((rect) => rect.width > 0);
}

function clearNoteGaps(root) {
  root.querySelectorAll(".note-gap").forEach((gap) => gap.remove());
}

function noteGapPx() {
  return Math.max(boxGapPx(), 12);
}

function anchorLineBox(anchor) {
  const rects = textLineRects(anchor);
  if (!rects.length) return null;
  const top = Math.min(...rects.map((rect) => rect.top));
  const line = rects.filter((rect) => rect.top <= top + 3);
  return {
    top,
    bottom: Math.max(...line.map((rect) => rect.bottom)),
    left: Math.min(...line.map((rect) => rect.left)),
    right: Math.max(...line.map((rect) => rect.right)),
  };
}

function visualLineStarts(root) {
  const starts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest(".inline-note, .note-gap")) return NodeFilter.FILTER_REJECT;
      return node.textContent.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent;
    for (let index = 0; index < text.length; index += 1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = [...range.getClientRects()].find((box) => box.width > 0 && box.height > 0);
      if (!rect) continue;
      const known = starts.find((line) => Math.abs(line.top - rect.top) < 4);
      if (!known) {
        starts.push({ top: rect.top, left: rect.left, node, offset: index });
        continue;
      }
      if (rect.left < known.left - 0.5) {
        known.left = rect.left;
        known.top = rect.top;
        known.node = node;
        known.offset = index;
      }
    }
  }
  return starts;
}

function fitInRow(row, preferred, width, gap, limit) {
  const min = gap;
  const max = Math.max(min, limit - width - gap);
  const blockers = row.slice().sort((a, b) => a.left - b.left);
  const candidates = [preferred];
  blockers.forEach((block) => {
    candidates.push(block.right + gap);
    candidates.push(block.left - gap - width);
  });
  let best = null;
  let bestDist = Infinity;
  candidates.forEach((candidate) => {
    const left = Math.min(max, Math.max(min, candidate));
    const right = left + width;
    const hit = blockers.some((block) => left < block.right + gap && right > block.left - gap);
    if (hit) return;
    const dist = Math.abs(left - preferred);
    if (dist < bestDist) {
      bestDist = dist;
      best = left;
    }
  });
  return best;
}

function packNoteRows(items, gap, limit) {
  const rows = [];
  items
    .slice()
    .sort((a, b) => a.center - b.center || a.width - b.width)
    .forEach((item) => {
      const preferred = Math.min(Math.max(gap, limit - item.width - gap), Math.max(gap, item.center - item.width / 2));
      let row = null;
      let left = preferred;
      for (const candidate of rows) {
        const fit = fitInRow(candidate, preferred, item.width, gap, limit);
        if (fit == null) continue;
        row = candidate;
        left = fit;
        break;
      }
      if (!row) {
        row = [];
        rows.push(row);
        left = Math.min(Math.max(gap, preferred), Math.max(gap, limit - item.width - gap));
      }
      row.push({ item, left, right: left + item.width });
    });
  return rows;
}

function localRect(rect, origin, root) {
  return {
    left: rect.left - origin.left + root.scrollLeft,
    right: rect.right - origin.left + root.scrollLeft,
    top: rect.top - origin.top + root.scrollTop,
    bottom: rect.bottom - origin.top + root.scrollTop,
  };
}

function glyphBoxes(root, origin) {
  const boxes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest(".inline-note, .note-gap")) return NodeFilter.FILTER_REJECT;
      return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) {
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    [...range.getClientRects()].forEach((rect) => {
      if (rect.width > 0 && rect.height > 0) boxes.push(localRect(rect, origin, root));
    });
  }
  return boxes;
}

function boxesOverlap(slot, box, pad = 1) {
  return slot.left < box.right + pad && slot.right > box.left - pad && slot.top < box.bottom + pad && slot.bottom > box.top - pad;
}

function noteCeiling(root, origin) {
  const tools = root.parentElement?.querySelector(".passage-tools");
  if (!tools) return 2;
  return tools.getBoundingClientRect().bottom - origin.top + root.scrollTop + 4;
}

function clampNoteLeft(left, width, limit) {
  const max = Math.max(2, limit - width - 2);
  return Math.min(Math.max(2, left), max);
}

function slotDistance(slot, item) {
  const noteCx = slot.left + item.width / 2;
  const noteCy = slot.top + item.height / 2;
  const wordCy = (item.lineTop + item.lineBottom) / 2;
  return Math.hypot(noteCx - item.center, noteCy - wordCy);
}

function wordOverlapWidth(left, width, item) {
  return Math.max(0, Math.min(left + width, item.wordRight) - Math.max(left, item.wordLeft));
}

function noteOverlapArea(slot, placed) {
  return placed.reduce((sum, box) => {
    const width = Math.max(0, Math.min(slot.right, box.right) - Math.max(slot.left, box.left));
    const height = Math.max(0, Math.min(slot.bottom, box.bottom) - Math.max(slot.top, box.top));
    return sum + width * height;
  }, 0);
}

function snugNoteTop(item, side, left, glyphs, ceiling) {
  const right = left + item.width;
  const pad = 2;
  const hits = glyphs.filter((box) => box.right > left + 1 && box.left < right - 1);
  if (side === "above") {
    const above = hits.filter((box) => box.bottom <= item.lineTop + 1);
    const ink = above.length ? Math.max(...above.map((box) => box.bottom)) : -Infinity;
    const top = item.lineTop - pad - item.height;
    if (top < ceiling || top < ink + pad) return null;
    return top;
  }
  const below = hits.filter((box) => box.top >= item.lineBottom - 1);
  const ink = below.length ? Math.min(...below.map((box) => box.top)) : Infinity;
  const top = item.lineBottom + pad;
  if (top + item.height > ink - pad) return null;
  return top;
}

function noteSlots(item, side, glyphs, placed, ceiling, limit) {
  const raw = [item.center - item.width / 2, item.wordLeft, item.wordRight - item.width];
  const seen = new Set();
  const slots = [];
  raw.forEach((value) => {
    const left = clampNoteLeft(value, item.width, limit);
    const key = Math.round(left);
    if (seen.has(key)) return;
    seen.add(key);
    const top = snugNoteTop(item, side, left, glyphs, ceiling);
    if (top == null) return;
    const slot = { left, right: left + item.width, top, bottom: top + item.height, side };
    if (glyphs.some((box) => boxesOverlap(slot, box, 1))) return;
    slot.wordOverlap = wordOverlapWidth(left, item.width, item);
    slot.noteOverlap = noteOverlapArea(slot, placed);
    slot.distance = slotDistance(slot, item);
    slots.push(slot);
  });
  slots.sort((a, b) => b.wordOverlap - a.wordOverlap || a.noteOverlap - b.noteOverlap || a.distance - b.distance);
  return slots;
}

function closerNoteSlot(above, below) {
  if (!above) return below;
  if (!below) return above;
  if (below.wordOverlap !== above.wordOverlap) return below.wordOverlap > above.wordOverlap ? below : above;
  if (above.noteOverlap !== below.noteOverlap) return above.noteOverlap < below.noteOverlap ? above : below;
  if (Math.abs(above.distance - below.distance) > 1) return above.distance < below.distance ? above : below;
  return above;
}

function stackPushedNotes(notes, gap) {
  const sample = notes[0];
  const rows = [];
  notes.forEach((entry) => {
    const placed = { ...entry, right: entry.left + entry.width };
    const row = rows.find((line) => line.every((other) => placed.left >= other.right + 4 || placed.right <= other.left - 4));
    if (row) row.push(placed);
    else rows.push([placed]);
  });
  let cursor = gap;
  const placed = [];
  rows.forEach((row) => {
    const rowHeight = Math.max(...row.map((entry) => entry.height));
    row.forEach((entry) => {
      const spot = {
        note: entry.note,
        left: entry.left,
        side: sample.side,
        push: true,
        lineTop: entry.lineTop,
        width: entry.width,
        height: entry.height,
      };
      if (sample.side === "below") spot.below = cursor;
      else spot.above = cursor + rowHeight;
      placed.push(spot);
    });
    cursor += rowHeight + gap;
  });
  return { placed, height: cursor, side: sample.side, lineTop: sample.lineTop };
}

function planInlineNotes(root) {
  const origin = root.getBoundingClientRect();
  const gap = noteGapPx();
  const limit = root.clientWidth;
  const ceiling = noteCeiling(root, origin);
  const glyphs = glyphBoxes(root, origin);
  const items = [...root.querySelectorAll(".inline-note")].flatMap((note) => {
    const box = anchorLineBox(note.closest(".memo-anchor"));
    if (!box) return [];
    const local = localRect(box, origin, root);
    return [{
      note,
      lineTop: local.top,
      lineBottom: local.bottom,
      viewportTop: box.top,
      center: (local.left + local.right) / 2,
      wordLeft: local.left,
      wordRight: local.right,
      width: note.offsetWidth,
      height: note.offsetHeight,
      gap,
    }];
  }).sort((a, b) => a.lineTop - b.lineTop || a.center - b.center);
  const occupied = [];
  const floating = [];
  const pushed = [];
  items.forEach((item) => {
    const above = noteSlots(item, "above", glyphs, occupied, ceiling, limit).find((slot) => slot.wordOverlap > 0);
    const below = noteSlots(item, "below", glyphs, occupied, ceiling, limit).find((slot) => slot.wordOverlap > 0);
    const choices = [closerNoteSlot(above, below)].filter(Boolean);
    if (choices.length) {
      const slot = choices[0];
      const spot = {
        note: item.note,
        left: slot.left,
        side: slot.side,
        push: false,
        lineTop: item.viewportTop,
        width: item.width,
        height: item.height,
      };
      if (slot.side === "below") spot.below = slot.top - item.lineBottom;
      else spot.above = item.lineTop - slot.top;
      floating.push(spot);
      occupied.push(slot);
      return;
    }
    const belowRoom = snugNoteTop(item, "below", clampNoteLeft(item.wordRight - item.width, item.width, limit), glyphs, ceiling);
    const side = item.lineTop - item.height - 2 < ceiling && belowRoom != null ? "below" : "above";
    pushed.push({
      note: item.note,
      left: clampNoteLeft(item.wordRight - item.width, item.width, limit),
      width: item.width,
      height: item.height,
      side,
      lineTop: item.viewportTop,
    });
  });
  const pushGroups = [];
  pushed.forEach((entry) => {
    const group = pushGroups.find((item) => item.side === entry.side && Math.abs(item.viewportTop - entry.lineTop) < 4);
    if (group) group.notes.push(entry);
    else pushGroups.push({ side: entry.side, viewportTop: entry.lineTop, notes: [entry] });
  });
  const stacked = pushGroups.map((group) => stackPushedNotes(group.notes, gap));
  stacked.forEach((group) => {
    group.placed.forEach((entry) => {
      const top = entry.side === "below" ? entry.lineTop + entry.below : entry.lineTop - entry.above;
      occupied.push({ left: entry.left, right: entry.left + entry.width, top, bottom: top + entry.height });
    });
  });
  return {
    placed: [...floating, ...stacked.flatMap((group) => group.placed)],
    gaps: stacked.map((group) => ({ side: group.side, lineTop: group.lineTop, height: group.height })),
  };
}

function insertNoteGaps(root, groups) {
  const starts = visualLineStarts(root);
  const specs = groups.flatMap((group) => {
    if (group.side === "below") {
      const next = starts.find((line) => line.top > group.lineTop + 8);
      if (next) return [{ ...next, height: group.height }];
      const gap = document.createElement("span");
      gap.className = "note-gap";
      gap.setAttribute("aria-hidden", "true");
      gap.style.height = `${group.height}px`;
      root.append(gap);
      return [];
    }
    const start = starts.find((line) => Math.abs(line.top - group.lineTop) < 6);
    return start ? [{ ...start, height: group.height }] : [];
  });
  specs.sort((a, b) => {
    if (a.node === b.node) return b.offset - a.offset;
    const position = a.node.compareDocumentPosition(b.node);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return 1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return -1;
    return b.top - a.top;
  });
  specs.forEach((spec) => {
    const gap = document.createElement("span");
    gap.className = "note-gap";
    gap.setAttribute("aria-hidden", "true");
    gap.style.height = `${spec.height}px`;
    const range = document.createRange();
    range.setStart(spec.node, spec.offset);
    range.collapse(true);
    range.insertNode(gap);
  });
}

function applyNotePositions(root, groups) {
  const origin = root.getBoundingClientRect();
  groups.forEach((group) => {
    group.placed.forEach((entry) => {
      const box = anchorLineBox(entry.note.closest(".memo-anchor"));
      if (!box) return;
      const top = entry.side === "below"
        ? box.bottom - origin.top + root.scrollTop + entry.below
        : box.top - origin.top + root.scrollTop - entry.above;
      entry.note.classList.toggle("is-below", entry.side === "below");
      entry.note.style.left = `${entry.left}px`;
      entry.note.style.top = `${top}px`;
    });
  });
}

function layoutInlineNotes(root) {
  clearNoteGaps(root);
  root.querySelectorAll(".inline-note.is-below").forEach((note) => note.classList.remove("is-below"));
  const plan = planInlineNotes(root);
  if (!plan.placed.length) return;
  insertNoteGaps(root, plan.gaps);
  applyNotePositions(root, [{ placed: plan.placed }]);
}

function wrappedLineRows(anchor) {
  const rows = [];
  textLineRects(anchor).forEach((rect) => {
    const row = rows.find((item) => rect.top < item.bottom - 1 && rect.bottom > item.top + 1);
    if (!row) {
      rows.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      return;
    }
    row.left = Math.min(row.left, rect.left);
    row.right = Math.max(row.right, rect.right);
    row.top = Math.min(row.top, rect.top);
    row.bottom = Math.max(row.bottom, rect.bottom);
  });
  rows.sort((a, b) => a.top - b.top || a.left - b.left);
  return rows;
}

function alignFrameEdges(lines) {
  if (lines.length < 2) return lines;
  const minLeft = Math.min(...lines.map((line) => line.left));
  const maxRight = Math.max(...lines.map((line) => line.right));
  const last = lines.length - 1;
  return lines.map((line, index) => ({
    ...line,
    left: index === 0 ? line.left : minLeft,
    right: index === last ? line.right : maxRight,
  }));
}

function sentenceFrameLines(anchor, root) {
  const origin = root.getBoundingClientRect();
  const padX = 2;
  const padY = 1;
  const lines = alignFrameEdges(wrappedLineRows(anchor).map((row) => ({
    left: Math.max(0.75, row.left - origin.left - root.clientLeft + root.scrollLeft - padX),
    right: row.right - origin.left - root.clientLeft + root.scrollLeft + padX,
    top: Math.max(0.75, row.top - origin.top - root.clientTop + root.scrollTop - padY),
    bottom: row.bottom - origin.top - root.clientTop + root.scrollTop + padY,
  })).filter((line) => line.right - line.left > 1 && line.bottom - line.top > 1));
  for (let index = 0; index < lines.length - 1; index += 1) {
    const mid = (lines[index].bottom + lines[index + 1].top) / 2;
    lines[index].bottom = mid;
    lines[index + 1].top = mid;
  }
  return lines;
}

function sentenceFramePath(lines) {
  const n = (value) => String(Math.round(value * 100) / 100);
  const cmd = [`M ${n(lines[0].left)} ${n(lines[0].top)}`, `H ${n(lines[0].right)}`];
  for (let index = 0; index < lines.length - 1; index += 1) {
    cmd.push(`V ${n(lines[index].bottom)}`, `H ${n(lines[index + 1].right)}`);
  }
  const last = lines[lines.length - 1];
  cmd.push(`V ${n(last.bottom)}`, `H ${n(last.left)}`);
  for (let index = lines.length - 1; index > 0; index -= 1) {
    cmd.push(`V ${n(lines[index].top)}`, `H ${n(lines[index - 1].left)}`);
  }
  cmd.push("Z");
  return cmd.join(" ");
}

const sentenceFrameObserver = new ResizeObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.target instanceof HTMLElement) paintSentenceFramesIn(entry.target);
  });
});

function paintSentenceFramesIn(root) {
  root.querySelectorAll(":scope > .sentence-frame").forEach((node) => node.remove());
  root.querySelectorAll(".sentence-memo.is-joined").forEach((anchor) => anchor.classList.remove("is-joined"));
}

function paintSentenceFrames() {
  document.querySelectorAll("[data-annotate]").forEach((root) => paintSentenceFramesIn(root));
}

function placeInlineNotes() {
  document.querySelectorAll("[data-annotate]").forEach((root) => {
    root.style.paddingTop = "";
    layoutInlineNotes(root);
  });
  paintSentenceFrames();
}

function syncMemoPalette() {
  const styleOn = selectedMemoStyle === "box" || selectedMemoStyle === "solid" || selectedMemoStyle === "wave";
  const hex = emphasisHex(selectedMemoColor);
  if (emphasisColors) emphasisColors.hidden = !styleOn;
  emphasisColors?.querySelectorAll("[data-hex]").forEach((button) => {
    button.setAttribute("aria-checked", styleOn && button.dataset.hex.toUpperCase() === hex ? "true" : "false");
  });
  if (!memoStyles) return;
  const color = colorParts(hex);
  memoStyles.style.setProperty("--style-swatch", color.swatch);
  memoStyles.style.setProperty("--style-line", color.line);
  memoStyles.querySelectorAll("[data-style]").forEach((button) => {
    button.setAttribute("aria-checked", button.dataset.style === selectedMemoStyle ? "true" : "false");
  });
  syncMemoPreview();
}

function cloneMarks(marks) {
  return marks.map((mark) => ({ ...mark }));
}

function syncUndoButtons() {
  const empty = annotationUndo.length === 0;
  document.querySelectorAll("[data-action='go-back']").forEach((button) => {
    button.disabled = empty;
    button.setAttribute("aria-disabled", empty ? "true" : "false");
  });
}

function commitMarks(root, marks, options = {}) {
  const passageId = root.dataset.annotate;
  const previous = marksFor(passageId);
  if (!options.skipHistory && JSON.stringify(previous) !== JSON.stringify(marks)) {
    annotationUndo.push({ passageId, marks: cloneMarks(previous) });
    if (annotationUndo.length > ANNOTATION_UNDO_LIMIT) annotationUndo.shift();
  }
  const store = loadMarks();
  store[passageId] = marks;
  saveMarkStore(store);
  paintAnnotations(root);
  syncUndoButtons();
}

function undoAnnotation() {
  const entry = annotationUndo.pop();
  if (!entry) return;
  const store = loadMarks();
  store[entry.passageId] = cloneMarks(entry.marks);
  saveMarkStore(store);
  document.querySelectorAll("[data-annotate]").forEach((root) => {
    if (root.dataset.annotate === entry.passageId) paintAnnotations(root);
  });
  noteTarget = null;
  activeSelection = null;
  hideToolbar();
  hideMemo();
  hideNote();
  hideNoteActions();
  window.getSelection()?.removeAllRanges();
  syncUndoButtons();
}

function splitAround(marks, from, to) {
  const next = [];
  marks.forEach((mark) => {
    if (mark.end <= from || mark.start >= to) {
      next.push(mark);
      return;
    }
    if (mark.start < from) next.push({ ...mark, end: from });
    if (mark.end > to) next.push({ ...mark, id: crypto.randomUUID(), start: to });
  });
  return next.filter((mark) => mark.end > mark.start);
}

function annotateRoot(range) {
  const node = range.commonAncestorContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const root = element?.closest("[data-annotate]");
  if (!root || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return root;
}

function textOffset(root, node, offset) {
  const range = document.createRange();
  try {
    range.setStart(root, 0);
    range.setEnd(node, offset);
  } catch {
    return 0;
  }
  let length = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(current) {
      return current.parentElement?.closest(".inline-note") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) {
    const current = walker.currentNode;
    let intersects = false;
    try {
      intersects = range.intersectsNode(current);
    } catch {
      intersects = false;
    }
    if (!intersects) continue;
    if (current === node && node.nodeType === Node.TEXT_NODE) {
      length += Math.min(offset, current.textContent.length);
      break;
    }
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(current);
    if (range.compareBoundaryPoints(Range.END_TO_END, nodeRange) < 0) break;
    length += current.textContent.length;
  }
  return Math.max(0, length);
}

function captureSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const root = annotateRoot(range);
  if (!root || !range.toString().trim()) return null;
  const start = textOffset(root, range.startContainer, range.startOffset);
  const end = textOffset(root, range.endContainer, range.endOffset);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  if (from === to) return null;
  const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  const endEl = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
  const startMark = startEl?.closest("mark.pen");
  const endMark = endEl?.closest("mark.pen");
  return {
    root,
    from,
    to,
    rect: range.getBoundingClientRect(),
    markId: startMark && startMark === endMark ? startMark.dataset.mark : "",
  };
}

function boxGapPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--box-gap").trim();
  if (raw.endsWith("mm")) return parseFloat(raw) * 96 / 25.4;
  if (raw.endsWith("px")) return parseFloat(raw);
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 11.34;
}

function placeNear(element, rect) {
  element.hidden = false;
  const box = element.getBoundingClientRect();
  const gap = boxGapPx();
  let top = rect.top - box.height - gap;
  const below = top < gap;
  if (below) top = rect.bottom + gap;
  element.classList.toggle("is-below", below);
  const left = Math.max(gap, Math.min(rect.left + rect.width / 2 - box.width / 2, window.innerWidth - box.width - gap));
  element.style.top = `${top}px`;
  element.style.left = `${left}px`;
}

function resetToolbarPane() {
  window.clearTimeout(toolbarPaneTimer);
  selectToolbar.querySelectorAll(".toolbar-pane").forEach((pane) => {
    pane.classList.remove("is-entering", "is-leaving");
    pane.hidden = pane.dataset.pane !== "actions";
  });
}

function hideToolbar() {
  selectToolbar.hidden = true;
  penEdit = null;
  resetToolbarPane();
}

function showToolbarPane(mode, rect) {
  const incoming = selectToolbar.querySelector(`[data-pane="${mode}"]`);
  const current = [...selectToolbar.querySelectorAll(".toolbar-pane")].find((pane) => !pane.hidden);
  const wasHidden = selectToolbar.hidden;
  window.clearTimeout(toolbarPaneTimer);
  if (!incoming) return;
  if (wasHidden || !current || current === incoming) {
    selectToolbar.querySelectorAll(".toolbar-pane").forEach((pane) => {
      pane.classList.remove("is-entering", "is-leaving");
      pane.hidden = pane !== incoming;
    });
    selectToolbar.hidden = false;
    placeNear(selectToolbar, rect);
    return;
  }
  selectToolbar.hidden = false;
  current.classList.add("is-leaving");
  incoming.hidden = false;
  incoming.classList.add("is-entering");
  placeNear(selectToolbar, rect);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => incoming.classList.remove("is-entering"));
  });
  toolbarPaneTimer = window.setTimeout(() => {
    current.hidden = true;
    current.classList.remove("is-leaving");
    if (rect) placeNear(selectToolbar, rect);
  }, 220);
}

function syncPenSwatches(activeColor, showClear) {
  selectToolbar.querySelectorAll("[data-action='pick-pen']").forEach((button) => {
    const on = PEN_COLORS.includes(activeColor) && button.dataset.color === activeColor;
    button.setAttribute("aria-checked", on ? "true" : "false");
  });
  const clear = selectToolbar.querySelector("[data-action='clear-pen']");
  if (clear) clear.hidden = !showClear;
}

function openPenPicker() {
  if (!activeSelection) return;
  penEdit = null;
  syncPenSwatches("", false);
  showToolbarPane("colors", activeSelection.rect);
}

function openPenEditor(markEl) {
  const root = markEl.closest("[data-annotate]");
  const id = markEl.dataset.mark;
  if (!root || !id) return;
  const saved = marksFor(root.dataset.annotate).find((item) => item.id === id);
  if (!saved) return;
  activeSelection = null;
  window.getSelection()?.removeAllRanges();
  penEdit = { root, id };
  syncPenSwatches(memoColor(saved.color), true);
  hideMemo();
  hideNoteActions();
  showToolbarPane("colors", markEl.getBoundingClientRect());
  if (memoDisplay === "click" && String(saved.note || "").trim()) showSavedNote(markEl, { keepToolbar: true });
}

function recolorMark(root, id, color) {
  const chosen = memoColor(color);
  const marks = marksFor(root.dataset.annotate).map((mark) => (
    mark.id === id ? { ...mark, color: chosen } : mark
  ));
  penEdit = null;
  commitMarks(root, marks);
  hideToolbar();
  hideNote();
}

function removePenMark(root, id) {
  const marks = marksFor(root.dataset.annotate).filter((mark) => mark.id !== id);
  penEdit = null;
  noteTarget = null;
  commitMarks(root, marks);
  hideToolbar();
  hideNote();
  hideNoteActions();
}

function currentMemoStyle() {
  return selectedMemoStyle === "solid" || selectedMemoStyle === "wave" ? selectedMemoStyle : "box";
}

function passageTextWalker(root) {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(current) {
      return current.parentElement?.closest(".inline-note") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
}

function domPointAt(root, offset) {
  let remaining = Math.max(0, offset);
  const walker = passageTextWalker(root);
  let last = null;
  while (walker.nextNode()) {
    const current = walker.currentNode;
    last = current;
    if (remaining <= current.textContent.length) return { node: current, offset: remaining };
    remaining -= current.textContent.length;
  }
  if (last) return { node: last, offset: last.textContent.length };
  return null;
}

function selectOffsets(root, start, end) {
  const from = domPointAt(root, Math.min(start, end));
  const to = domPointAt(root, Math.max(start, end));
  if (!from || !to) return;
  const range = document.createRange();
  try {
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
  } catch {
    return;
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function memoPreviewModel() {
  if (memoPopover.hidden || !memoDraft?.root) return null;
  const passageId = memoDraft.root.dataset.annotate;
  if (!passageId) return null;
  const text = loadPassages().find((item) => item.id === passageId)?.body || "";
  let start = memoDraft.from;
  let end = memoDraft.to;
  let scope = markScope(text, start, end);
  if (memoDraft.id) {
    const saved = marksFor(passageId).find((mark) => mark.id === memoDraft.id);
    if (!saved) return null;
    start = saved.start;
    end = saved.end;
    scope = scopeOf(text, saved);
  } else if (scope === "sentence") {
    [start, end] = sentenceBounds(text, start);
  }
  const kept = tidyPiece(text, start, Math.min(end, text.length));
  if (!kept) return null;
  return {
    passageId,
    id: memoDraft.id || MEMO_PREVIEW_ID,
    start: kept[0],
    end: kept[1],
    scope,
    style: currentMemoStyle(),
    color: emphasisHex(selectedMemoColor),
    editing: Boolean(memoDraft.id),
  };
}

function marksWithMemoPreview(passageId) {
  const marks = marksFor(passageId);
  const preview = memoPreviewModel();
  if (!preview || preview.passageId !== passageId) return marks;
  if (preview.editing) {
    return marks.map((mark) => (
      mark.id === preview.id
        ? { ...mark, color: preview.color, style: preview.style, scope: preview.scope, preview: true }
        : mark
    ));
  }
  return [...marks, {
    id: preview.id,
    start: preview.start,
    end: preview.end,
    note: "",
    color: preview.color,
    scope: preview.scope,
    style: preview.style,
    preview: true,
  }];
}

function memoPreviewRect(root) {
  const id = memoDraft?.id || MEMO_PREVIEW_ID;
  let selector = "";
  try {
    selector = `[data-mark="${CSS.escape(id)}"]`;
  } catch {
    return null;
  }
  const rects = [...root.querySelectorAll(selector)]
    .flatMap((node) => [...node.getClientRects()])
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!rects.length) return null;
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  return { top, bottom, left, width: right - left, height: bottom - top };
}

function syncMemoPreview() {
  if (memoPopover.hidden || !memoDraft?.root?.isConnected) return;
  const preview = memoPreviewModel();
  const signature = preview
    ? [preview.passageId, preview.id, preview.start, preview.end, preview.style, preview.color, preview.scope].join(":")
    : "";
  const root = memoDraft.root;
  if (signature !== memoPreviewSignature) {
    memoPreviewSignature = signature;
    if (signature) paintAnnotations(root);
  }
  if (!signature) return;
  const rect = memoPreviewRect(root);
  if (rect) placeNear(memoPopover, rect);
}

function cancelScheduledPreviewRestore() {
  if (!memoPreviewRestore) return;
  window.removeEventListener("pointerup", memoPreviewRestore, true);
  window.removeEventListener("pointercancel", memoPreviewRestore, true);
  memoPreviewRestore = null;
}

function schedulePreviewRestore(root) {
  cancelScheduledPreviewRestore();
  memoPreviewRoot = root;
  pendingSelectionRestore = null;
  memoPreviewRestore = () => {
    cancelScheduledPreviewRestore();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const pendingRoot = memoPreviewRoot;
        const pendingSelection = pendingSelectionRestore;
        memoPreviewRoot = null;
        pendingSelectionRestore = null;
        if (pendingRoot?.isConnected) paintAnnotations(pendingRoot);
        if (pendingSelection && pendingSelection.root === pendingRoot && pendingRoot?.isConnected) {
          selectOffsets(pendingRoot, pendingSelection.from, pendingSelection.to);
        }
      });
    });
  };
  window.addEventListener("pointerup", memoPreviewRestore, true);
  window.addEventListener("pointercancel", memoPreviewRestore, true);
}

function releaseMemoComposer() {
  cancelScheduledPreviewRestore();
  memoPreviewRoot = null;
  pendingSelectionRestore = null;
  memoPopover.hidden = true;
  memoDraft = null;
  memoPreviewSignature = "";
}

function dismissMemoPreview(defer) {
  const root = memoDraft?.root;
  const dirty = Boolean(memoDraft) || memoPreviewSignature !== "";
  memoPopover.hidden = true;
  memoDraft = null;
  memoPreviewSignature = "";
  if (!dirty || !root?.isConnected) {
    cancelScheduledPreviewRestore();
    memoPreviewRoot = null;
    return;
  }
  if (defer) {
    schedulePreviewRestore(root);
    return;
  }
  cancelScheduledPreviewRestore();
  memoPreviewRoot = null;
  pendingSelectionRestore = null;
  paintAnnotations(root);
}

function hideMemo() {
  if (!memoDraft && memoPopover.hidden) return;
  dismissMemoPreview(false);
}

function rebindMemoDraft() {
  if (!memoDraft) return;
  const passageId = memoDraft.root?.dataset?.annotate || "";
  let next = null;
  try {
    next = passageId ? document.querySelector(`[data-annotate="${CSS.escape(passageId)}"]`) : null;
  } catch {
    next = null;
  }
  if (!next) {
    memoPopover.hidden = true;
    memoDraft = null;
    memoPreviewSignature = "";
    return;
  }
  memoDraft.root = next;
}

function hideNote() {
  notePopover.hidden = true;
}

function hideNoteActions() {
  noteActions.hidden = true;
}

function showToolbarFromSelection() {
  if (eraserOn) {
    hideToolbar();
    return;
  }
  const captured = captureSelection();
  if (!captured) {
    hideToolbar();
    return;
  }
  activeSelection = captured;
  penEdit = null;
  hideMemo();
  syncWordbookToolbar();
  if (memoPreviewRoot && captured.root === memoPreviewRoot) {
    pendingSelectionRestore = { root: captured.root, from: captured.from, to: captured.to };
  }
  hideNote();
  resetToolbarPane();
  placeNear(selectToolbar, captured.rect);
}

function highlightSelection(note = "", color = "", styleChoice = "") {
  if (!activeSelection) return null;
  const { root, from, to, markId } = activeSelection;
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  const text = passage?.body || "";
  const scope = markScope(text, from, to);
  let start = from;
  let end = to;
  if (scope === "sentence") [start, end] = sentenceBounds(text, from);
  let marks = marksFor(root.dataset.annotate);
  const sameScope = (mark) => scopeOf(text, mark) === scope;
  const overlapping = marks.filter((mark) => sameScope(mark) && rangesOverlap(start, end, mark));
  const explicit = memoStyle(styleChoice, true);
  const insideWave = !explicit && scope === "word" && overlapping.some((mark) => (
    markStyle(mark) === "wave" && mark.start <= start && mark.end >= end && (mark.start < start || mark.end > end)
  ));
  const coveredByFill = !explicit && scope === "word" && overlapping.some((mark) => markStyle(mark) === "fill" && mark.start <= start && mark.end >= end);
  const style = explicit || (scope === "word" && insideWave ? "solid" : (scope === "word" && coveredByFill ? "wave" : (scope === "sentence" ? "solid" : "fill")));
  const exactSame = overlapping.find((mark) => markStyle(mark) === style && mark.start === start && mark.end === end);
  const chosen = storedColor(color || exactSame?.color);
  const finish = (next, id) => {
    next.sort((a, b) => a.start - b.start || a.end - b.end);
    commitMarks(root, next);
    window.getSelection()?.removeAllRanges();
    activeSelection = null;
    hideToolbar();
    return id;
  };
  if (exactSame && note === "" && !color) {
    hideToolbar();
    window.getSelection()?.removeAllRanges();
    activeSelection = null;
    return exactSame.id;
  }
  if (exactSame && note === "" && color && storedColor(exactSame.color) === chosen && markStyle(exactSame, scope) === style) {
    hideToolbar();
    window.getSelection()?.removeAllRanges();
    activeSelection = null;
    return exactSame.id;
  }
  if (exactSame && note === "" && color) {
    const next = marks.map((mark) => (
      mark.id === exactSame.id ? { ...mark, color: chosen, scope, style } : mark
    ));
    return finish(next, exactSame.id);
  }
  if (markId && note !== "" && exactSame?.id === markId && exactSame) {
    marks = marks.map((mark) => (mark.id === markId ? { ...mark, note, color: chosen, scope, style: explicit || markStyle(exactSame, scope) } : mark));
    commitMarks(root, marks);
    return markId;
  }
  const incoming = {
    id: crypto.randomUUID(),
    start,
    end,
    note,
    color: chosen,
    scope,
    style,
  };
  marks.push(incoming);
  return finish(marks, incoming.id);
}

function openMemoEditor() {
  if (!activeSelection) return;
  const { root, from, to, rect } = activeSelection;
  memoDraft = { root, from, to, id: "" };
  memoInput.value = "";
  selectedMemoColor = "#FFE066";
  selectedMemoStyle = "box";
  memoPreviewSignature = "";
  hideToolbar();
  hideNote();
  placeNear(memoPopover, rect);
  syncMemoPalette();
  memoInput.focus();
}

function saveMemo(event) {
  event.preventDefault();
  if (!memoDraft?.root?.isConnected) return;
  const { root, from, to, id } = memoDraft;
  const note = memoInput.value.trim();
  const color = emphasisHex(selectedMemoColor);
  const style = currentMemoStyle();
  const passageId = root.dataset.annotate;
  const text = loadPassages().find((item) => item.id === passageId)?.body || "";
  const marks = marksFor(passageId);
  if (id) {
    releaseMemoComposer();
    commitMarks(root, marks.map((mark) => (
      mark.id === id ? { ...mark, note, color, style } : mark
    )));
    return;
  }
  const scope = markScope(text, from, to);
  let start = from;
  let end = to;
  if (scope === "sentence") [start, end] = sentenceBounds(text, from);
  const kept = tidyPiece(text, start, Math.min(end, text.length));
  releaseMemoComposer();
  if (!kept) return;
  const [rangeStart, rangeEnd] = kept;
  const same = marks.find((mark) => (
    scopeOf(text, mark) === scope
    && mark.start === rangeStart
    && mark.end === rangeEnd
    && markStyle(mark, scope) === style
  ));
  const next = same
    ? marks.map((mark) => (mark.id === same.id ? { ...mark, note, color, style, scope } : mark))
    : [...marks, {
      id: crypto.randomUUID(),
      start: rangeStart,
      end: rangeEnd,
      note,
      color,
      scope,
      style,
    }];
  commitMarks(root, next);
}

function showSavedNote(mark, options = {}) {
  const root = mark.closest("[data-annotate]");
  const list = root ? marksFor(root.dataset.annotate) : [];
  const ids = [mark.dataset.mark, mark.dataset.underlay, ...(mark.dataset.stack || "").split(",")].filter(Boolean);
  const items = [...new Set(ids)].map((id) => list.find((item) => item.id === id)).filter(Boolean);
  const noted = items.filter((item) => item.note?.trim());
  if (noted.length > 1) {
    notePopoverText.textContent = noted.map((item) => `${styleLabel(item)}\n${item.note.trim()}`).join("\n\n");
  } else {
    notePopoverText.textContent = noted[0]?.note?.trim() || "이 형광펜에는 메모가 없습니다.";
  }
  const target = noted[0] || null;
  noteTarget = target && root ? { root, id: target.id } : null;
  notePopoverActions.hidden = !target;
  if (!options.keepToolbar) hideToolbar();
  hideMemo();
  hideNoteActions();
  placeNear(notePopover, mark.getBoundingClientRect());
  if (!options.keepToolbar) return;
  const bar = selectToolbar.getBoundingClientRect();
  const noteBox = notePopover.getBoundingClientRect();
  const gap = boxGapPx();
  if (noteBox.top < bar.bottom + gap && noteBox.bottom > bar.top - gap) {
    notePopover.style.top = `${bar.bottom + gap}px`;
  }
}

function showNoteActions(anchor) {
  const root = anchor.closest("[data-annotate]");
  const id = anchor.dataset.inlineNote;
  if (!root || !id) return;
  noteTarget = { root, id };
  hideToolbar();
  hideMemo();
  hideNote();
  placeNear(noteActions, anchor.getBoundingClientRect());
}

function editTargetMemo() {
  if (!noteTarget) return;
  const { root, id } = noteTarget;
  const saved = marksFor(root.dataset.annotate).find((item) => item.id === id);
  if (!saved) return;
  const rect = (noteActions.hidden ? notePopover : noteActions).getBoundingClientRect();
  memoDraft = { root, from: saved.start, to: saved.end, id };
  memoInput.value = saved.note || "";
  selectedMemoColor = emphasisHex(saved.color);
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  const savedStyle = markStyle(saved, scopeOf(passage?.body || "", saved));
  selectedMemoStyle = savedStyle === "solid" || savedStyle === "wave" || savedStyle === "box" ? savedStyle : "box";
  memoPreviewSignature = "";
  hideToolbar();
  hideNote();
  hideNoteActions();
  placeNear(memoPopover, rect);
  syncMemoPalette();
  memoInput.focus();
}

function deleteTargetMemo() {
  if (!noteTarget) return;
  const { root, id } = noteTarget;
  const marks = marksFor(root.dataset.annotate).map((item) => (item.id === id ? { ...item, note: "" } : item));
  noteTarget = null;
  hideNote();
  hideNoteActions();
  hideMemo();
  commitMarks(root, marks);
}

function passageTools() {
  const wordOn = eraserMode === "word";
  const inlineOn = memoDisplay === "inline";
  return `
    <div class="passage-tools">
      <button type="button" class="ghost" data-action="go-back" title="최근 필기 취소" aria-label="최근 필기 취소" ${annotationUndo.length ? "" : "disabled"}>뒤로가기</button>
      <div class="eraser-menu">
        <button type="button" class="ghost${eraserOn ? " is-on" : ""}" data-action="toggle-eraser" aria-pressed="${eraserOn}" aria-haspopup="menu">지우개</button>
        <div class="eraser-options" role="menu" aria-label="지우개 범위">
          <button type="button" role="menuitemradio" aria-checked="${wordOn}" data-action="eraser-mode" data-mode="word">단어 단위 지우기</button>
          <button type="button" role="menuitemradio" aria-checked="${!wordOn}" data-action="eraser-mode" data-mode="sentence">문장 단위 지우기</button>
        </div>
      </div>
      <div class="memo-display" role="radiogroup" aria-label="메모 노출 방식">
        <span class="memo-display-label">메모</span>
        <button type="button" role="radio" aria-checked="${!inlineOn}" data-action="memo-display" data-mode="click">클릭할 때</button>
        <button type="button" role="radio" aria-checked="${inlineOn}" data-action="memo-display" data-mode="inline">항상 표시</button>
      </div>
    </div>
  `;
}

function setMemoDisplay(mode) {
  memoDisplay = mode === "inline" ? "inline" : "click";
  localStorage.setItem(MEMO_DISPLAY_KEY, memoDisplay);
  document.querySelectorAll("[data-action='memo-display']").forEach((button) => {
    button.setAttribute("aria-checked", button.dataset.mode === memoDisplay ? "true" : "false");
  });
  document.querySelectorAll("[data-annotate]").forEach((root) => paintAnnotations(root));
  hideNote();
  hideNoteActions();
}

function setEraser(on) {
  eraserOn = on;
  document.body.classList.toggle("is-erasing", on);
  document.querySelectorAll("[data-action='toggle-eraser']").forEach((button) => {
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("is-on", on);
  });
}

function setEraserMode(mode) {
  eraserMode = mode === "sentence" ? "sentence" : "word";
  localStorage.setItem(ERASER_MODE_KEY, eraserMode);
  document.querySelectorAll("[data-action='eraser-mode']").forEach((button) => {
    button.setAttribute("aria-checked", button.dataset.mode === eraserMode ? "true" : "false");
  });
  setEraser(true);
}

function wordBounds(text, index) {
  if (!text) return null;
  const letter = (char) => /[A-Za-z0-9]/.test(char || "");
  const glue = (char) => char === "'" || char === "’" || char === "-";
  let i = Math.min(Math.max(index, 0), text.length - 1);
  if (!letter(text[i])) {
    if (i > 0 && letter(text[i - 1])) i -= 1;
    else return null;
  }
  let start = i;
  let end = i + 1;
  while (start > 0 && (letter(text[start - 1]) || (glue(text[start - 1]) && letter(text[start - 2])))) start -= 1;
  while (end < text.length && (letter(text[end]) || (glue(text[end]) && letter(text[end + 1])))) end += 1;
  return [start, end];
}

function offsetAtPoint(root, x, y) {
  const positioned = document.caretRangeFromPoint?.(x, y);
  if (!positioned || !root.contains(positioned.startContainer)) return null;
  return textOffset(root, positioned.startContainer, positioned.startOffset);
}

function sentenceBounds(text, index) {
  const point = Math.min(Math.max(index, 0), Math.max(text.length - 1, 0));
  let start = 0;
  for (let i = point - 1; i >= 0; i -= 1) {
    if (/[.!?]/.test(text[i])) {
      start = i + 1;
      break;
    }
  }
  while (start < text.length && /\s/.test(text[start])) start += 1;
  let end = text.length;
  for (let i = point; i < text.length; i += 1) {
    if (/[.!?]/.test(text[i])) {
      end = i + 1;
      break;
    }
  }
  return [start, end];
}

function cutMarks(marks, text, from, to, scope) {
  const next = [];
  const push = (item, start, end) => {
    const kept = tidyPiece(text, start, end);
    if (kept) next.push({ ...item, start: kept[0], end: kept[1] });
  };
  marks.forEach((item) => {
    if (scope && scopeOf(text, item) !== scope) {
      next.push(item);
      return;
    }
    if (item.end <= from || item.start >= to) {
      push(item, item.start, item.end);
      return;
    }
    if (item.start < from) push(item, item.start, from);
    if (item.end > to) push({ ...item, id: crypto.randomUUID() }, to, item.end);
  });
  return next;
}

function eraseRange(root, from, to, scope) {
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  if (!passage || from >= to) return;
  commitMarks(root, cutMarks(marksFor(passage.id), passage.body, from, to, scope));
  hideNote();
  hideToolbar();
  window.getSelection()?.removeAllRanges();
}

function eraseAt(root, index, mode) {
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  if (!passage) return;
  if (mode === "sentence") {
    const [start, end] = sentenceBounds(passage.body, index);
    eraseRange(root, start, end, "sentence");
    return;
  }
  const bounds = wordBounds(passage.body, index >= passage.body.length ? passage.body.length - 1 : index);
  if (!bounds) return;
  eraseRange(root, bounds[0], bounds[1], "word");
}

function passageBanner() {
  const passage = activePassage();
  if (!passage) {
    return `
      <section class="panel dashed">
        <p class="exam-label">현재 본문</p>
        <p class="lead">학습할 본문이 아직 선택되지 않았습니다. 본문 목록에서 공부할 글을 고르면 이 화면에 내용이 따라옵니다.</p>
        <a class="kicker" href="#/passage">본문 선택하기</a>
      </section>
    `;
  }
  const category = categoryById(passage.categoryId);
  return `
    <section class="panel">
      <div class="between">
        <p class="kicker">현재 본문</p>
        <p class="tiny">${esc(category?.label || "")}</p>
      </div>
      <h2>${esc(passage.title)}</h2>
      ${passageTools()}
      <p class="passage-body" data-annotate="${esc(passage.id)}" lang="en">${annotatedHtml(passage.body, marksWithMemoPreview(passage.id))}</p>
    </section>
  `;
}

function renderPassage(categoryId) {
  const body = draftBody();
  const canSave = body.trim().length > 0 && draft.ocrState !== "loading";
  const passages = loadPassages();
  const category = categoryById(categoryId);
  const items = passages.filter((item) => item.categoryId === categoryId);
  const list = items.length
    ? `
        <section>
          <h3 class="tiny">${esc(category?.label || "본문")} · ${items.length}개</h3>
          <div class="stack">
            ${items.map((passage) => {
              const selected = passage.id === activePassageId();
              return `
                <article class="passage-item${selected ? " is-selected" : ""}">
                  <div class="passage-head">
                    <button type="button" class="title" data-action="select-passage" data-id="${esc(passage.id)}" aria-pressed="${selected}">
                      <span class="between"><strong>${esc(passage.title)}</strong>${selected ? '<span class="kicker">학습 중</span>' : ""}</span>
                      <span class="tiny">${esc(dateFormat.format(new Date(passage.createdAt)))}</span>
                      <span class="clamp">${esc(passage.body)}</span>
                    </button>
                    ${passage.imageName ? `
                      <button type="button" class="passage-thumb" data-action="open-saved-image" data-id="${esc(passage.id)}">
                        <img data-passage-image="${esc(passage.id)}" alt="">
                        <span class="sr-only">${esc(passage.title)} 이미지를 크게 보고 본문 고치기</span>
                      </button>
                    ` : ""}
                  </div>
                  <div class="list-actions">
                    <button type="button" class="pill" data-action="select-passage" data-id="${esc(passage.id)}">선택하기</button>
                    <button type="button" class="ghost" data-action="edit-passage" data-id="${esc(passage.id)}">수정</button>
                    <button type="button" class="ghost" data-action="delete-passage" data-id="${esc(passage.id)}">삭제</button>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </section>
    `
    : `<p class="lead">${esc(category?.label || "이 카테고리")}에 저장된 본문이 없습니다.</p>`;

  const textPanel = `
    <div>
      <label class="field" for="passage-body">영어 본문
        <textarea id="passage-body" data-field="passage-body" class="plain-text" lang="en" rows="12" placeholder="영어 본문을 붙여 넣으세요."></textarea>
      </label>
      <p class="tiny">글은 이 칸에 붙여 넣고, 이미지는 화면 어디에서나 Ctrl+V로 올릴 수 있습니다.</p>
    </div>
  `;
  const imagePanel = `
    <div>
      <div class="dropzone" data-dropzone="image" tabindex="0">
        <strong>이미지를 끌어다 놓거나, 파일을 고르거나, 붙여 넣으세요</strong>
        <span class="tiny">PNG, JPG, WEBP, GIF · 8MB 이하 · Ctrl+V</span>
        <label class="ghost" style="margin-top:3mm">
          파일 선택
          <input id="passage-file" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" tabindex="-1">
        </label>
      </div>
      ${draft.previewUrl ? `
        <div class="preview">
          <button type="button" class="preview-open" data-action="open-image">
            <img src="${esc(draft.previewUrl)}" alt="">
            <span class="sr-only">이미지를 크게 보고 본문 고치기</span>
          </button>
          <div>
            <p>${esc(draft.imageName || "이미지")}</p>
            <p class="tiny">${draft.ocrState === "loading" ? "글자를 읽는 중" : "이미지를 누르면 크게 보며 본문을 고칠 수 있습니다."}</p>
            <div class="list-actions">
              <button type="button" class="ghost" data-action="reread-image">다시 읽기</button>
              <button type="button" class="ghost" data-action="clear-image">이미지 지우기</button>
            </div>
          </div>
        </div>
      ` : ""}
      <label class="field" for="image-body">인식된 본문
        <textarea id="image-body" data-field="image-body" class="plain-text" lang="en" rows="12" placeholder="이미지에서 읽은 글이 여기에 들어갑니다. 직접 고쳐도 됩니다." ${draft.ocrState === "loading" ? "disabled" : ""}></textarea>
      </label>
    </div>
  `;

  const reviewField = document.activeElement?.id === "image-review-body" ? document.activeElement : null;
  const reviewSelection = reviewField ? [reviewField.selectionStart, reviewField.selectionEnd] : null;

  viewEl.innerHTML = `
    <div class="wrap page">
      <div class="passage-layout">
        <section class="panel passage-card">
          <h1>${draft.editingId ? "저장한 본문 고치기" : "본문 업로드"}</h1>
          <div class="tabs" role="tablist" aria-label="입력 방식">
            <button type="button" data-action="passage-mode" data-mode="text" aria-selected="${draft.mode === "text"}">텍스트 직접 입력</button>
            <button type="button" data-action="passage-mode" data-mode="image" aria-selected="${draft.mode === "image"}">이미지 업로드</button>
          </div>
          <label class="field" for="passage-title">제목 <span class="tiny">필수</span>
            <input id="passage-title" data-field="passage-title" class="plain-input" placeholder="예: Lesson 3 The Power of Words" required>
          </label>
          <div style="margin-top:3mm">${draft.mode === "text" ? textPanel : imagePanel}</div>
          ${draft.message ? `<p class="message ${esc(draft.messageTone)}" role="status">${esc(draft.message)}</p>` : ""}
          <div class="between" style="margin-top:3mm">
            <p class="tiny" data-live="char-count">${body.trim().length.toLocaleString("ko-KR")}자</p>
            <button type="button" class="pill" data-action="save-passage" ${canSave ? "" : "disabled"}>${draft.editingId ? "수정 내용 저장" : "본문 저장"}</button>
          </div>
        </section>
        <aside class="panel list-card">
          <h2>저장된 본문</h2>
          <div class="stack">${list}</div>
        </aside>
      </div>
    </div>
    ${imageReview()}
  `;
  const title = viewEl.querySelector("#passage-title");
  const text = viewEl.querySelector("#passage-body");
  const image = viewEl.querySelector("#image-body");
  const reviewTitle = viewEl.querySelector("#image-review-title");
  const reviewBody = viewEl.querySelector("#image-review-body");
  if (title) title.value = draft.title;
  if (reviewTitle) reviewTitle.value = draft.title;
  if (text) text.value = draft.textBody;
  if (image) image.value = draft.imageBody;
  if (reviewBody) {
    reviewBody.value = draft.imageBody;
    if (reviewSelection) {
      reviewBody.focus();
      reviewBody.setSelectionRange(reviewSelection[0], reviewSelection[1]);
    }
  }
  const savedBody = viewEl.querySelector("#saved-review-body");
  const savedTitle = viewEl.querySelector("#saved-review-title");
  if (savedImageReview) {
    if (savedTitle) savedTitle.value = savedImageReview.title;
    if (savedBody) savedBody.value = savedImageReview.body;
  }
  hydratePassageImages();
  document.title = "본문 업로드 · EngSel 엥셀";
}

function imageReview() {
  if (savedImageReview) {
    const review = savedImageReview;
    const canSave = review.body.trim().length > 0 && review.title.trim().length > 0;
    return `
      <div class="image-review" role="dialog" aria-modal="true" aria-labelledby="image-review-heading">
        <div class="image-review-sheet">
          <div class="image-review-bar">
            <div>
              <p id="image-review-heading">이미지를 보며 고치기</p>
              <p class="tiny">${esc(review.imageName || "이미지")}</p>
            </div>
            <button type="button" class="ghost" data-action="close-image">닫기</button>
          </div>
          <div class="image-review-grid">
            <div class="image-review-photo">
              <img src="${esc(review.imageUrl)}" alt="${esc(review.imageName || "저장한 이미지")}">
            </div>
            <div class="image-review-editor">
              <label class="field" for="saved-review-title">제목 <span class="tiny">필수</span>
                <input id="saved-review-title" data-field="saved-review-title" class="plain-input" placeholder="예: Lesson 3 The Power of Words" required>
              </label>
              <label class="field image-review-text" for="saved-review-body">인식된 본문
                <textarea id="saved-review-body" data-field="saved-review-body" class="plain-text" lang="en" placeholder="이미지에서 읽은 글이 여기에 들어갑니다. 직접 고쳐도 됩니다."></textarea>
              </label>
              ${review.notice ? `<p class="message error" role="status">${esc(review.notice)}</p>` : ""}
              <div class="between">
                <p class="tiny" data-live="saved-char-count">${review.body.trim().length.toLocaleString("ko-KR")}자</p>
                <button type="button" class="pill" data-action="save-saved-review" ${canSave ? "" : "disabled"}>수정 내용 저장</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  if (!draft.imageOpen || !draft.previewUrl || draft.mode !== "image") return "";
  const body = draft.imageBody;
  const canSave = body.trim().length > 0 && draft.ocrState !== "loading";
  return `
    <div class="image-review" role="dialog" aria-modal="true" aria-labelledby="image-review-heading">
      <div class="image-review-sheet">
        <div class="image-review-bar">
          <div>
            <p id="image-review-heading">이미지를 보며 고치기</p>
            <p class="tiny">${esc(draft.imageName || "이미지")}</p>
          </div>
          <button type="button" class="ghost" data-action="close-image">닫기</button>
        </div>
        <div class="image-review-grid">
          <div class="image-review-photo">
            <img src="${esc(draft.previewUrl)}" alt="${esc(draft.imageName || "올린 이미지")}">
          </div>
          <div class="image-review-editor">
            <label class="field" for="image-review-title">제목 <span class="tiny">필수</span>
              <input id="image-review-title" data-field="passage-title" class="plain-input" placeholder="예: Lesson 3 The Power of Words" required>
            </label>
            <label class="field image-review-text" for="image-review-body">인식된 본문
              <textarea id="image-review-body" data-field="image-body" class="plain-text" lang="en" placeholder="이미지에서 읽은 글이 여기에 들어갑니다. 직접 고쳐도 됩니다." ${draft.ocrState === "loading" ? "disabled" : ""}></textarea>
            </label>
            ${draft.message ? `<p class="message ${esc(draft.messageTone)}" role="status">${esc(draft.message)}</p>` : ""}
            <div class="between">
              <p class="tiny" data-live="char-count">${body.trim().length.toLocaleString("ko-KR")}자</p>
              <button type="button" class="pill" data-action="save-passage" ${canSave ? "" : "disabled"}>${draft.editingId ? "수정 내용 저장" : "본문 저장"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

const FLOW_STRONG = /^(however|nevertheless|nonetheless|on the other hand|in contrast|by contrast|conversely|instead|in conclusion|to conclude|in summary|to sum up|for example|for instance|as a result|consequently|in the end|at first|in the past|years later|today|nowadays|these days)\b/i;
const FLOW_MEDIUM = /^(but|yet|therefore|thus|hence|so|moreover|furthermore|in addition|additionally|meanwhile|later|then|next|finally|first|second|third|in fact|above all|most importantly|on the one hand|after all|at the same time)\b/i;
const FLOW_STOP = new Set("this that these those with from into onto upon about after before while where which their there they them then than have been being were was your just only also very more most some such will would could should might must shall does did done make made many much other another across because during without within against around through into".split(/\s+/));

function loadFlowStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FLOW_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function removeFlowRecord(passageId) {
  const store = loadFlowStore();
  if (!Object.prototype.hasOwnProperty.call(store, passageId)) return;
  delete store[passageId];
  localStorage.setItem(FLOW_KEY, JSON.stringify(store));
}

function flowGroupsCover(groups, count) {
  if (!Array.isArray(groups) || !groups.length || !count) return false;
  let expect = 0;
  for (const group of groups) {
    if (!Array.isArray(group) || group.length !== 2) return false;
    const start = group[0];
    const end = group[1];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start !== expect || end < start || end >= count) return false;
    expect = end + 1;
  }
  return expect === count;
}

function sentenceRanges(text) {
  const ranges = [];
  const source = String(text || "");
  const abbrev = /\b(?:Mr|Mrs|Ms|Dr|Prof|Jr|Sr|St|vs|etc|e\.g|i\.e|U\.S|U\.K)\.$/i;
  let start = 0;
  while (start < source.length && /\s/.test(source[start])) start += 1;
  let index = start;
  while (index < source.length) {
    if (!/[.!?]/.test(source[index])) {
      index += 1;
      continue;
    }
    const slice = source.slice(start, index + 1);
    const decimal = source[index] === "." && /\d/.test(source[index - 1] || "") && /\d/.test(source[index + 1] || "");
    const abbreviation = source[index] === "." && abbrev.test(slice);
    const gap = source.slice(index + 1).match(/^\s*/)?.[0] || "";
    const nextChar = source[index + 1 + gap.length] || "";
    const boundary = !decimal && !abbreviation && (!nextChar || /[A-Z“"']/.test(nextChar) || /\n/.test(gap));
    if (!boundary) {
      index += 1;
      continue;
    }
    if (source.slice(start, index + 1).trim()) ranges.push({ start, end: index + 1 });
    start = index + 1 + gap.length;
    index = start;
  }
  if (start < source.length && source.slice(start).trim()) ranges.push({ start, end: source.length });
  return ranges;
}

function flowContentWords(text) {
  return (String(text).match(/[A-Za-z']+/g) || [])
    .map((word) => word.toLowerCase().replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 3 && !FLOW_STOP.has(word));
}

function sectionsFromGroups(text, sentences, groups) {
  return groups.map(([from, to]) => {
    const start = sentences[from].start;
    const end = sentences[to].end;
    return { start, end, text: text.slice(start, end).replace(/\s+$/g, "").replace(/^\s+/g, "") };
  });
}

function flowShouldSplit(text, current, next, gap) {
  const head = text.slice(next.start, next.end).replace(/^[\s“"'‘’]+/, "");
  const strong = FLOW_STRONG.test(head);
  const medium = FLOW_MEDIUM.test(head);
  const wordsSoFar = flowContentWords(current.map((sentence) => text.slice(sentence.start, sentence.end)).join(" ")).length;
  const nextWords = flowContentWords(text.slice(next.start, next.end));
  const seen = new Set(flowContentWords(current.map((sentence) => text.slice(sentence.start, sentence.end)).join(" ")));
  const shared = nextWords.filter((word) => seen.has(word)).length;
  const overlap = nextWords.length ? shared / nextWords.length : 1;
  const paragraphGap = /\n\s*\n/.test(gap);
  if (strong && wordsSoFar >= 8) return true;
  if ((medium || paragraphGap) && wordsSoFar >= 24 && overlap < 0.2) return true;
  if (wordsSoFar >= 40 && nextWords.length >= 3 && overlap === 0) return true;
  return false;
}

function segmentByFlow(text) {
  const sentences = sentenceRanges(text);
  if (!sentences.length) return [];
  const groups = [];
  let from = 0;
  for (let index = 1; index < sentences.length; index += 1) {
    const gap = text.slice(sentences[index - 1].end, sentences[index].start);
    if (flowShouldSplit(text, sentences.slice(from, index), sentences[index], gap)) {
      groups.push([from, index - 1]);
      from = index;
    }
  }
  groups.push([from, sentences.length - 1]);
  return sectionsFromGroups(text, sentences, groups);
}

function assignFlowNotes(sections, notes) {
  const used = new Set();
  const saved = Array.isArray(notes) ? notes : [];
  return sections.map((section) => {
    let best = -1;
    let bestScore = 0;
    saved.forEach((note, index) => {
      if (used.has(index) || typeof note?.note !== "string" || !note.note) return;
      if (note.start === section.start && note.end === section.end) {
        best = index;
        bestScore = 3;
        return;
      }
      if (note.text === section.text && bestScore < 2) {
        best = index;
        bestScore = 2;
        return;
      }
      const overlap = Math.min(note.end, section.end) - Math.max(note.start, section.start);
      const span = Math.max(section.end - section.start, 1);
      const score = overlap / span;
      if (score >= 0.6 && score > bestScore) {
        best = index;
        bestScore = score;
      }
    });
    if (best >= 0) used.add(best);
    const picked = best >= 0 ? saved[best] : null;
    const feedback = picked?.feedback && picked.feedback.forNote === picked.note ? picked.feedback : null;
    return { ...section, note: picked?.note || "", feedback };
  });
}

function flowState(passage) {
  const saved = loadFlowStore()[passage.id];
  const same = saved && saved.body === passage.body;
  const sentences = sentenceRanges(passage.body);
  const groups = same && flowGroupsCover(saved.groups, sentences.length) ? saved.groups : null;
  const sections = groups ? sectionsFromGroups(passage.body, sentences, groups) : segmentByFlow(passage.body);
  return assignFlowNotes(sections, same ? saved.notes : []);
}

function saveFlowRecord(passageId, groups) {
  const passage = loadPassages().find((item) => item.id === passageId);
  if (!passage) return;
  const store = loadFlowStore();
  const previous = store[passageId] && store[passageId].body === passage.body ? store[passageId] : {};
  store[passageId] = {
    body: passage.body,
    groups: groups === undefined ? previous.groups || null : groups,
    notes: flowView.map((section) => ({
      start: section.start,
      end: section.end,
      text: section.text,
      note: section.note,
      feedback: section.feedback && section.feedback.forNote === section.note ? section.feedback : null,
    })),
  };
  localStorage.setItem(FLOW_KEY, JSON.stringify(store));
}

function flowFeedbackHtml(section) {
  const feedback = section.feedback && section.feedback.forNote === section.note ? section.feedback : null;
  if (!feedback) return `<div class="flow-feedback" data-live="flow-feedback" hidden></div>`;
  return `
    <div class="flow-feedback" data-live="flow-feedback" data-for-note="${esc(feedback.forNote)}">
      <h4>AI 핵심 요약</h4>
      <p>${esc(feedback.summary)}</p>
      <h4>비교 및 피드백</h4>
      <p>${esc(feedback.comparison)}</p>
    </div>
  `;
}

function flowCards() {
  return flowView.map((section, index) => `
    <li class="flow-card" data-flow="${index}">
      <div class="flow-source">
        <p class="flow-index">흐름 ${index + 1}</p>
        <p class="flow-text" lang="en">${esc(section.text)}</p>
      </div>
      <div class="flow-note">
        <label>
          <span class="flow-note-label">한국어 핵심 생각</span>
          <textarea rows="5" lang="ko" data-field="flow-note" data-index="${index}" placeholder="이 흐름에서 글이 말하려는 핵심을 한국어로 적으세요.">${esc(section.note)}</textarea>
        </label>
        <span class="tiny" data-live="flow-save">자동 저장</span>
        <button type="button" class="ghost" data-action="flow-feedback" data-index="${index}">피드백 받기</button>
      </div>
      ${flowFeedbackHtml(section)}
    </li>
  `).join("");
}

function showFlowFeedback(index, message, review) {
  const card = viewEl.querySelector(`.flow-card[data-flow="${index}"]`);
  const panel = card?.querySelector("[data-live='flow-feedback']");
  const button = card?.querySelector("[data-action='flow-feedback']");
  if (button) {
    button.disabled = false;
    button.textContent = "피드백 받기";
  }
  if (!panel) return;
  if (review) {
    panel.hidden = false;
    panel.dataset.forNote = review.forNote;
    panel.innerHTML = `<h4>AI 핵심 요약</h4><p>${esc(review.summary)}</p><h4>비교 및 피드백</h4><p>${esc(review.comparison)}</p>`;
    return;
  }
  panel.hidden = false;
  delete panel.dataset.forNote;
  panel.innerHTML = `<p class="flow-feedback-error">${esc(message)}</p>`;
}

async function requestFlowFeedback(index) {
  const section = flowView[index];
  if (!section || !flowPassageId) return;
  const note = section.note.trim();
  if (!note) {
    showFlowFeedback(index, "핵심 생각을 먼저 적으면 그 내용과 지문을 비교할 수 있습니다.");
    return;
  }
  const card = viewEl.querySelector(`.flow-card[data-flow="${index}"]`);
  const button = card?.querySelector("[data-action='flow-feedback']");
  if (button) {
    button.disabled = true;
    button.textContent = "살펴보는 중";
  }
  const passageId = flowPassageId;
  const token = flowToken;
  try {
    const response = await fetch("/api/flow-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: section.text, summary: note }),
    });
    const payload = await response.json().catch(() => ({}));
    if (token !== flowToken || flowPassageId !== passageId || currentPath() !== "/rewrite" || flowView[index] !== section) return;
    if (!response.ok || typeof payload.summary !== "string" || typeof payload.comparison !== "string") {
      showFlowFeedback(index, payload.error || "피드백을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    section.feedback = { forNote: section.note, summary: payload.summary.trim(), comparison: payload.comparison.trim() };
    saveFlowRecord(passageId);
    showFlowFeedback(index, "", section.feedback);
  } catch {
    if (token !== flowToken || flowPassageId !== passageId) return;
    showFlowFeedback(index, "피드백을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function paintFlow(statusText) {
  const list = viewEl.querySelector("[data-live='flow-list']");
  if (list) list.innerHTML = flowCards();
  const status = viewEl.querySelector("[data-live='flow-status']");
  if (!status) return;
  if (statusText) {
    status.hidden = false;
    status.textContent = statusText;
  } else {
    status.hidden = true;
  }
}

function applyPendingFlow() {
  if (!flowPending) return;
  document.querySelectorAll("[data-field='flow-note']").forEach((field) => {
    const index = Number(field.dataset.index);
    if (flowView[index]) flowView[index].note = field.value;
  });
  flowView = assignFlowNotes(flowPending, flowView);
  flowPending = null;
  const groups = flowPendingGroups;
  flowPendingGroups = null;
  if (flowPassageId) saveFlowRecord(flowPassageId, groups);
  paintFlow("");
}

async function refineFlow(passageId, token) {
  const passage = loadPassages().find((item) => item.id === passageId);
  if (!passage || token !== flowToken || currentPath() !== "/rewrite") return;
  const sentences = sentenceRanges(passage.body);
  if (sentences.length < 2) return;
  const saved = loadFlowStore()[passageId];
  if (saved && saved.body === passage.body && flowGroupsCover(saved.groups, sentences.length)) return;
  try {
    const response = await fetch("/api/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentences: sentences.map((sentence) => passage.body.slice(sentence.start, sentence.end).trim()) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (token !== flowToken || flowPassageId !== passageId || currentPath() !== "/rewrite") return;
    if (!response.ok || !flowGroupsCover(payload.groups, sentences.length)) {
      paintFlow("흐름 단서로 나누어 두었습니다.");
      return;
    }
    const sections = assignFlowNotes(
      sectionsFromGroups(passage.body, sentences, payload.groups),
      flowView,
    );
    const same = sections.length === flowView.length && sections.every((section, index) => section.start === flowView[index].start && section.end === flowView[index].end);
    if (same) {
      saveFlowRecord(passageId, payload.groups);
      paintFlow("");
      return;
    }
    if (document.activeElement?.dataset?.field === "flow-note") {
      flowPending = sections;
      flowPendingGroups = payload.groups;
      paintFlow("입력을 마치면 의미 흐름에 맞춰 다시 묶습니다.");
      return;
    }
    flowView = sections;
    saveFlowRecord(passageId, payload.groups);
    paintFlow("");
  } catch {
    if (token !== flowToken || flowPassageId !== passageId) return;
    paintFlow("흐름 단서로 나누어 두었습니다.");
  }
}

function renderNotes(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  const category = categoryById(current?.categoryId || categoryId);
  const reader = current
    ? `
      <section class="panel reader-panel">
        <div class="between">
          <p class="kicker">현재 본문</p>
          <p class="tiny">${esc(category?.label || "")} · ${current.body.trim().length.toLocaleString("ko-KR")}자</p>
        </div>
        <h2 class="reader-title">${esc(current.title)}</h2>
        ${passageTools()}
        <div class="reader-body" data-annotate="${esc(current.id)}" lang="en">${annotatedHtml(current.body, marksWithMemoPreview(current.id))}</div>
      </section>
    `
    : `
      <section class="panel dashed reader-panel">
        <p class="kicker">현재 본문</p>
        <p class="lead">위에서 공부할 본문을 고르면 전체 글이 여기에 펼쳐집니다. 글자를 드래그해 표시하면서 읽을 수 있습니다.</p>
      </section>
    `;

  viewEl.innerHTML = `
    <div class="wrap page stack notes-page">
      <div>
        <h1>학습 노트</h1>
      </div>
      ${passagePicker(categoryId)}
      ${reader}
    </div>
  `;
  document.title = "학습 노트 · EngSel 엥셀";
}

function renderRewrite(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  const category = categoryById(current?.categoryId || categoryId);
  if (current) {
    flowPassageId = current.id;
    flowPending = null;
    flowPendingGroups = null;
    flowView = flowState(current);
  } else {
    flowPassageId = "";
    flowPending = null;
    flowPendingGroups = null;
    flowView = [];
  }
  const savedFlow = current ? loadFlowStore()[current.id] : null;
  const sentenceCount = current ? sentenceRanges(current.body).length : 0;
  const waiting = Boolean(current && sentenceCount > 1 && !(savedFlow && savedFlow.body === current.body && flowGroupsCover(savedFlow.groups, sentenceCount)));
  const analysis = current
    ? `
      <section class="panel">
        <div class="between">
          <p class="kicker">현재 본문</p>
          <p class="tiny">${esc(category?.label || "")} · ${current.body.trim().length.toLocaleString("ko-KR")}자</p>
        </div>
        <h2 class="reader-title">${esc(current.title)}</h2>
        <div class="flow-head">
          <h3>의미 흐름별 문단 분석 및 한국어 정리</h3>
          <p class="lead">줄바꿈이나 원래 문단과 상관없이, 주제와 논리의 흐름이 바뀌는 곳에서 본문을 나누었습니다. 옆칸에 핵심을 적고 피드백 받기를 누르면, 그 흐름의 핵심과 비교해 알려 줍니다.</p>
          <p class="tiny" data-live="flow-status"${waiting ? "" : " hidden"}>의미 흐름을 다시 확인하고 있습니다.</p>
        </div>
        <ol class="flow-list" data-live="flow-list">${flowCards()}</ol>
      </section>
    `
    : `
      <section class="panel dashed">
        <p class="kicker">현재 본문</p>
        <p class="lead">위에서 공부할 본문을 고르면 의미 흐름마다 나누어 한국어로 정리할 수 있습니다.</p>
      </section>
    `;

  viewEl.innerHTML = `
    <div class="wrap page stack flow-page">
      <div>
        <h1>한국어 정리</h1>
      </div>
      ${passagePicker(categoryId)}
      ${analysis}
    </div>
  `;
  document.title = "한국어 정리 · EngSel 엥셀";
  if (current) {
    flowToken += 1;
    refineFlow(current.id, flowToken);
  }
}

function stableRank(text) {
  let hash = 0;
  const value = String(text);
  for (let index = 0; index < value.length; index += 1) hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
  return hash;
}

function rankVocabOptions(options, passageId, itemIndex, answerIndex) {
  const ranked = options.map((word, index) => ({
    word,
    index,
    rank: stableRank(`${passageId}:${itemIndex}:${index}:${word}`),
  }));
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return {
    options: ranked.map((item) => item.word),
    answer: ranked.findIndex((item) => item.index === answerIndex),
  };
}

const VOCAB_STOP = new Set(`a an the this that these those there their they them then than with from into about over after before between among through during without within upon onto your yours our ours his her hers its she him who whom whose what how why not nor but and for are was were been being has had did does doing done can may might must shall will would could should you your of in on to at by as or if so no yes be is am it we he my me us do have said says say make made go went get got people thing things something anything nothing everything time way year years day days man men woman women world life part case point fact use used using new old good bad great high low long short large small many much more most other another such only even also just well back still first last next same own very really however therefore although though because since while however`.split(/\s+/));

const VERB_BASES = new Set(`accept achieve act add admit affect agree allow answer appear apply argue ask avoid become begin believe bring build call carry catch cause change choose claim come compare consider continue contribute create decide describe develop die discover discuss draw drop eat enable encourage end enjoy enter examine exist expect explain express fail fall feel find finish follow force forget form get give go grow happen help hold hope identify imagine improve include increase indicate involve join keep know lead learn leave let like live look lose love make mean meet move need notice offer open order own pass pay perform place plan play prefer prepare present prevent produce provide put raise reach read realize receive recognize reduce refuse remain remember remove replace report require rest result return rise run save say see seem sell send separate serve set show sit sleep solve speak spend stand start stay stop study succeed suggest support take talk teach tell tend think treat try turn understand use wait walk want watch win work write`.split(/\s+/));

const PARTICIPLE_PAIRS = {
  making: "made", made: "making", leading: "led", led: "leading", laying: "laid", laid: "laying",
  seeing: "seen", seen: "seeing", doing: "done", done: "doing", going: "gone", gone: "going",
  taking: "taken", taken: "taking", giving: "given", given: "giving", writing: "written", written: "writing",
  knowing: "known", known: "knowing", growing: "grown", grown: "growing", showing: "shown", shown: "showing",
  beginning: "begun", begun: "beginning", falling: "fallen", fallen: "falling", feeling: "felt", felt: "feeling",
  keeping: "kept", kept: "keeping", leaving: "left", left: "leaving", losing: "lost", lost: "losing",
  meaning: "meant", meant: "meaning", paying: "paid", paid: "paying", sending: "sent", sent: "sending",
  sleeping: "slept", slept: "sleeping", spending: "spent", spent: "spending", telling: "told", told: "telling",
  understanding: "understood", understood: "understanding", bringing: "brought", brought: "bringing",
  buying: "bought", bought: "buying", teaching: "taught", taught: "teaching", catching: "caught", caught: "catching",
  seeking: "sought", sought: "seeking", finding: "found", found: "finding", building: "built", built: "building",
  holding: "held", held: "holding", hearing: "heard", heard: "hearing", standing: "stood", stood: "standing",
  sitting: "sat", sat: "sitting",   running: "run", coming: "come", come: "coming", becoming: "become",
  become: "becoming", getting: "got", setting: "set", putting: "put", cutting: "cut", letting: "let",
  winning: "won", won: "winning", reading: "read",
};

const IRREGULAR_BASES = new Set("read make take come go do have be run get sit write give know grow show begin fall feel keep leave lose mean pay send sleep spend tell understand bring buy teach catch seek find build hold hear stand win become set put cut let lead lay see".split(/\s+/));

const VOCAB_CONFUSABLES = {
  influence: "indifference", intellectual: "physical", innovation: "imitation", isolation: "participation",
  devoted: "avoided", permanent: "occasional", benefit: "detriment", sacrifices: "comforts",
  penances: "rewards", deliverance: "punishment", parallel: "ordinary", save: "condemn",
  affect: "effect", effect: "affect", accept: "except", except: "accept", adapt: "adopt", adopt: "adapt",
  advice: "advise", advise: "advice", conserve: "preserve", preserve: "conserve", refuse: "deny", deny: "refuse",
  increase: "decrease", decrease: "increase", advantage: "disadvantage", success: "failure", failure: "success",
  significant: "trivial", essential: "optional", previous: "following", modern: "ancient", ancient: "modern",
  complex: "simple", simple: "complex", require: "provide", provide: "require", research: "assumption",
  evidence: "rumor", theory: "practice", practice: "theory", individual: "community", community: "individual",
  positive: "negative", negative: "positive", available: "scarce", sufficient: "insufficient", efficient: "wasteful",
  frequent: "rare", rare: "frequent", similar: "different", different: "similar", particular: "general",
  general: "particular", various: "identical", necessary: "unnecessary", possible: "impossible", important: "minor",
  develop: "abandon", create: "destroy", destroy: "create", reduce: "expand", expand: "reduce", prevent: "allow",
  allow: "prevent", encourage: "discourage", support: "oppose", oppose: "support", improve: "worsen",
  maintain: "neglect", recognize: "ignore", ignore: "recognize", contain: "exclude", include: "exclude",
  exclude: "include", approach: "avoid", avoid: "approach", consider: "dismiss", assume: "verify",
  indicate: "conceal", establish: "abolish", acquire: "lose", contribute: "detract", demonstrate: "hide",
  emphasize: "downplay", interpret: "misread", participate: "withdraw", transform: "preserve", survive: "perish",
  challenge: "accept", opportunity: "obstacle", obstacle: "opportunity", solution: "problem", problem: "solution",
  knowledge: "ignorance", ignorance: "knowledge", memory: "forgetting", attention: "neglect", behavior: "inaction",
  environment: "isolation", culture: "nature", society: "individual", technology: "tradition", tradition: "innovation",
  education: "ignorance", student: "teacher", students: "teachers", teacher: "student", teachers: "students",
  study: "neglect", studies: "rumors", learning: "forgetting", information: "confusion", experience: "theory",
  result: "cause", cause: "result", process: "accident", method: "accident", purpose: "accident", ability: "inability",
  effort: "neglect", habit: "exception", pattern: "exception", structure: "chaos", relationship: "separation",
  difference: "similarity", similarity: "difference", condition: "exception", situation: "solution",
  population: "individual", generation: "ancestor", history: "future", future: "past", natural: "artificial",
  human: "mechanical", physical: "mental", mental: "physical", emotional: "logical", social: "private",
  private: "public", public: "private", original: "copied", specific: "vague", common: "rare", recent: "ancient",
  major: "minor", basic: "advanced", advanced: "basic", effective: "useless", useful: "useless", likely: "unlikely",
  certain: "doubtful", clear: "obscure", difficult: "easy", easy: "difficult", true: "false", false: "true",
  economic: "economical", historic: "historical", continuous: "continual", principal: "principle",
  principle: "principal", sensible: "sensitive", sensitive: "sensible", stationary: "stationery",
  imply: "infer", infer: "imply", raise: "rise", rise: "raise", loose: "lose", lose: "loose",
};

function matchCase(sample, next) {
  const text = String(next || "");
  if (!text) return "";
  if (sample === sample.toUpperCase()) return text.toUpperCase();
  if (sample[0] === sample[0].toUpperCase()) return text.charAt(0).toUpperCase() + text.slice(1);
  return text.toLowerCase();
}

function locatePhrase(source, phrase, used) {
  const needle = String(phrase || "").trim();
  if (needle.length < 2 || needle.length > 48) return null;
  const lower = source.toLowerCase();
  const target = needle.toLowerCase();
  let from = 0;
  while (from < source.length) {
    const at = lower.indexOf(target, from);
    if (at < 0) return null;
    const end = at + needle.length;
    const before = at === 0 || !/[A-Za-z]/.test(source[at - 1]);
    const after = end >= source.length || !/[A-Za-z]/.test(source[end]);
    const overlap = used.some(([start, stop]) => at < stop && end > start);
    if (before && after && !overlap) return { start: at, end, word: source.slice(at, end) };
    from = at + 1;
  }
  return null;
}

function otherParticiple(word) {
  const lower = String(word || "").toLowerCase();
  if (PARTICIPLE_PAIRS[lower]) return matchCase(word, PARTICIPLE_PAIRS[lower]);
  if (lower.endsWith("ing") && lower.length >= 5) {
    let stem = lower.slice(0, -3);
    if (stem.length >= 4 && stem.at(-1) === stem.at(-2) && !"aeiou".includes(stem.at(-1))) stem = stem.slice(0, -1);
    if (IRREGULAR_BASES.has(stem)) return "";
    if (/^[^aeiou]*[aeiou][^aeiou]$/.test(stem) && stem.length <= 4) return matchCase(word, `${stem}${stem.at(-1)}ed`);
    if (stem.endsWith("y") && stem.length > 2 && !"aeiou".includes(stem.at(-2))) return matchCase(word, `${stem.slice(0, -1)}ied`);
    return matchCase(word, `${stem}ed`);
  }
  if (/[^aeiou]ied$/i.test(lower) && lower.length >= 5) return matchCase(word, `${lower.slice(0, -3)}ying`);
  if (lower.endsWith("ed") && lower.length >= 4) {
    const stem = lower.slice(0, -2);
    if (stem.length >= 4 && stem.at(-1) === stem.at(-2) && !"aeiou".includes(stem.at(-1))) return matchCase(word, `${stem}ing`);
    return matchCase(word, `${stem}ing`);
  }
  return "";
}

function toGerund(base) {
  const lower = String(base || "").toLowerCase();
  if (PARTICIPLE_PAIRS[lower] && String(PARTICIPLE_PAIRS[lower]).endsWith("ing")) return PARTICIPLE_PAIRS[lower];
  const direct = {
    be: "being", have: "having", do: "doing", see: "seeing", make: "making", take: "taking", come: "coming",
    get: "getting", give: "giving", write: "writing", run: "running", sit: "sitting", lie: "lying", die: "dying",
    save: "saving", provide: "providing", observe: "observing", devote: "devoting", separate: "separating",
  };
  if (direct[lower]) return direct[lower];
  if (lower.endsWith("ie")) return `${lower.slice(0, -2)}ying`;
  if (lower.endsWith("e") && !lower.endsWith("ee")) return `${lower.slice(0, -1)}ing`;
  if (/^[^aeiou]*[aeiou][^aeiou]$/.test(lower) && lower.length <= 4) return `${lower}${lower.at(-1)}ing`;
  return `${lower}ing`;
}

function pushPoint(list, point) {
  if (!point || !point.word || !point.distractor) return;
  if (point.word.toLowerCase() === point.distractor.toLowerCase()) return;
  if (/[\[\]/]/.test(point.distractor) || /[\[\]/]/.test(point.word)) return;
  list.push(point);
}

function scanGrammarPoints(source) {
  const points = [];
  const passive = /\b(?:am|is|are|was|were|been|being)\s+(?:[A-Za-z]+ed|led|made|seen|done|gone|taken|given|written|known|left|lost|told|found|held|shown|built|felt|kept|meant|paid|sent|spent|brought|taught|caught|laid|begun|fallen|grown|understood|sought)\b/gi;
  for (const match of source.matchAll(passive)) {
    const parts = match[0].split(/\s+/);
    pushPoint(points, {
      word: match[0],
      distractor: parts[1],
      start: match.index,
      end: match.index + match[0].length,
      kind: "passive",
      priority: 6,
    });
  }
  const prepRelative = /\b(?:in|on|at|to|for|with|from|by|of)\s+(?:which|whom)\b/gi;
  for (const match of source.matchAll(prepRelative)) {
    const relative = match[0].split(/\s+/)[1];
    pushPoint(points, {
      word: match[0],
      distractor: relative,
      start: match.index,
      end: match.index + match[0].length,
      kind: "relative",
      priority: 6,
    });
  }
  const infinitive = /\bto\s+([A-Za-z]{2,12})\b/gi;
  for (const match of source.matchAll(infinitive)) {
    const base = match[1].toLowerCase();
    if (!VERB_BASES.has(base)) continue;
    pushPoint(points, {
      word: match[0],
      distractor: matchCase(match[1], toGerund(base)),
      start: match.index,
      end: match.index + match[0].length,
      kind: "infinitive",
      priority: 5,
    });
  }
  const relatives = { who: "which", whom: "who", whose: "who's", which: "who", where: "which", when: "where" };
  for (const match of source.matchAll(/\b(who|whom|whose|which|where|when)\b/gi)) {
    const key = match[1].toLowerCase();
    pushPoint(points, {
      word: match[0],
      distractor: matchCase(match[0], relatives[key]),
      start: match.index,
      end: match.index + match[0].length,
      kind: "relative",
      priority: 5,
    });
  }
  const thatSkip = new Set("say said think thought know knew believe believed hope hoped show shows showed suggest suggests mean means meant is are was were be been being seem seems felt feel feels argue argues claim claims note notes find found so and but if because than after before when while although though since until unless whether once as not very the a an".split(/\s+/));
  for (const match of source.matchAll(/\b([A-Za-z]+)\s+(that)\b/g)) {
    if (thatSkip.has(match[1].toLowerCase())) continue;
    const start = match.index + match[0].length - match[2].length;
    pushPoint(points, {
      word: match[2],
      distractor: "what",
      start,
      end: start + match[2].length,
      kind: "relative",
      priority: 4,
    });
  }
  const swaps = { is: "are", are: "is", was: "were", were: "was", has: "have", have: "has", does: "do", do: "does" };
  const agreement = /\b(?:each|every|everyone|everybody|there|he|she|it)\b(?:\s+[A-Za-z]+){0,3}\s+(is|are|was|were|has|have|does|do)\b/gi;
  for (const match of source.matchAll(agreement)) {
    const verb = match[1];
    const start = match.index + match[0].lastIndexOf(verb);
    pushPoint(points, {
      word: verb,
      distractor: swaps[verb.toLowerCase()],
      start,
      end: start + verb.length,
      kind: "agreement",
      priority: 5,
    });
  }
  for (const match of source.matchAll(/\balthough\b|\bthough\b|\bdespite\b|\bbecause of\b|\bbecause\b/gi)) {
    const word = match[0];
    const key = word.toLowerCase();
    let distractor = "";
    if (key === "although" || key === "though") distractor = "despite";
    else if (key === "despite") distractor = "although";
    else if (key === "because of") distractor = "because";
    else if (key === "because" && !/^of\b/i.test(source.slice(match.index + word.length).trimStart())) distractor = "because of";
    pushPoint(points, {
      word,
      distractor,
      start: match.index,
      end: match.index + word.length,
      kind: "conjunction",
      priority: 4,
    });
  }
  for (const match of source.matchAll(/\blay\b/gi)) {
    pushPoint(points, {
      word: match[0],
      distractor: matchCase(match[0], "laid"),
      start: match.index,
      end: match.index + match[0].length,
      kind: "participle",
      priority: 4,
    });
  }
  for (const surface of ["made", "led", "laid", "seen", "done", "taken", "given", "written", "known", "shown", "begun", "fallen", "felt", "kept", "lost", "meant", "paid", "sent", "spent", "told", "brought", "taught", "caught", "sought", "built", "understood"]) {
    for (const match of source.matchAll(new RegExp(`\\b${surface}\\b`, "gi"))) {
      const distractor = otherParticiple(match[0]);
      pushPoint(points, {
        word: match[0],
        distractor,
        start: match.index,
        end: match.index + match[0].length,
        kind: "participle",
        priority: 3,
      });
    }
  }
  const skipParticiple = new Set("during being having according including concerning".split(/\s+/));
  for (const match of source.matchAll(/\b[A-Za-z]{4,}(?:ing|ed|ied)\b/g)) {
    const lower = match[0].toLowerCase();
    if (skipParticiple.has(lower) || VOCAB_STOP.has(lower)) continue;
    const distractor = otherParticiple(match[0]);
    if (!distractor || distractor.toLowerCase() === lower) continue;
    pushPoint(points, {
      word: match[0],
      distractor,
      start: match.index,
      end: match.index + match[0].length,
      kind: "participle",
      priority: lower.length >= 7 ? 3 : 2,
    });
  }
  return points;
}

function looseGrammarPoints(source) {
  const points = [];
  for (const match of source.matchAll(/\b[A-Za-z]{4,}\b/g)) {
    const word = match[0];
    const lower = word.toLowerCase();
    if (VOCAB_STOP.has(lower)) continue;
    let singular = "";
    if (/(?:x|z|ch|sh|ss)es$/i.test(lower)) singular = lower.slice(0, -2);
    else if (/[^aeiou]ies$/i.test(lower)) singular = `${lower.slice(0, -3)}y`;
    else if (/[^s]s$/i.test(lower) && !lower.endsWith("ss") && !lower.endsWith("us") && !lower.endsWith("is")) singular = lower.slice(0, -1);
    if (!singular || singular.length < 3) continue;
    pushPoint(points, {
      word,
      distractor: matchCase(word, singular),
      start: match.index,
      end: match.index + word.length,
      kind: "loose",
      priority: 1,
    });
  }
  return points;
}

function takeGrammarPoints(points) {
  const limits = { passive: 3, infinitive: 2, relative: 3, participle: 4, agreement: 2, conjunction: 2, loose: 4 };
  const counts = {};
  const sorted = points.slice().sort((a, b) => b.priority - a.priority || a.start - b.start);
  const chosen = [];
  for (const point of sorted) {
    const count = counts[point.kind] || 0;
    if (count >= (limits[point.kind] || 2)) continue;
    if (chosen.some((item) => item.start < point.end && item.end > point.start)) continue;
    counts[point.kind] = count + 1;
    chosen.push(point);
    if (chosen.length === 8) break;
  }
  chosen.sort((a, b) => a.start - b.start);
  return chosen;
}

function pointsToItems(points, passageId) {
  return points.map((point, index) => ({
    ...rankVocabOptions([point.word, point.distractor], passageId, index, 0),
    start: point.start,
    end: point.end,
    point: point.kind || (point.strong ? "confusable" : "context"),
  }));
}

function dynamicVocabPoints(source) {
  const matches = [];
  for (const match of source.matchAll(/\b[A-Za-z][A-Za-z'-]{3,}\b/g)) {
    const word = match[0];
    const key = word.toLowerCase();
    if (VOCAB_STOP.has(key) || key.includes("'")) continue;
    if (matches.some((item) => item.key === key)) continue;
    matches.push({ word, key, start: match.index, end: match.index + word.length });
  }
  const pool = matches.filter((item) => item.word.length >= 5);
  const hits = [];
  matches.forEach((match, index) => {
    const known = VOCAB_CONFUSABLES[match.key];
    let distractor = "";
    let strong = false;
    if (known) {
      distractor = matchCase(match.word, known);
      strong = true;
    } else if (pool.length > 1) {
      const other = pool[(index + 3) % pool.length];
      if (!other || other.key === match.key) return;
      distractor = matchCase(match.word, other.key);
    }
    if (!distractor || distractor.toLowerCase() === match.key) return;
    hits.push({ ...match, distractor, strong });
  });
  hits.sort((a, b) => Number(b.strong) - Number(a.strong) || b.word.length - a.word.length || a.start - b.start);
  return hits;
}

function bracketVocabQuestions(source, passageId) {
  const items = [];
  const pattern = /\[([^\[\]]+)\]/g;
  let match = pattern.exec(source);
  while (match) {
    const raw = match[1].split("/").map((part) => part.trim()).filter(Boolean);
    if (raw.length >= 2) {
      const marked = raw.findIndex((word) => word.startsWith("*") || word.endsWith("*"));
      const options = raw.map((word) => word.replace(/^\*+|\*+$/g, "").trim()).filter(Boolean);
      if (options.length >= 2) {
        const answerIndex = marked >= 0 && marked < options.length ? marked : 0;
        items.push({
          ...rankVocabOptions(options, passageId, items.length, answerIndex),
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
    match = pattern.exec(source);
  }
  return items;
}

function buildVocabQuestions(body, passageId) {
  const source = String(body || "");
  const bracketed = bracketVocabQuestions(source, passageId);
  if (bracketed.length) return { items: bracketed, fallback: [], draft: false };
  const points = dynamicVocabPoints(source);
  const strongPoints = points.filter((point) => point.strong);
  const byStart = (list) => list.slice(0, 8).sort((a, b) => a.start - b.start);
  const chosen = byStart(strongPoints.length >= 3 ? strongPoints : points);
  const items = pointsToItems(chosen, passageId);
  const draft = source.trim().length >= 80 && /[A-Za-z]{4,}/.test(source) && strongPoints.length < 3;
  if (!draft) return { items, fallback: [], draft: false };
  const fallback = pointsToItems(byStart(strongPoints.length ? strongPoints : points), passageId);
  return { items: [], fallback, draft: true };
}

function buildGrammarQuestions(body, passageId) {
  const source = String(body || "");
  const scanned = takeGrammarPoints(scanGrammarPoints(source));
  if (scanned.length) return { items: pointsToItems(scanned, passageId), fallback: [], draft: false };
  const loose = pointsToItems(takeGrammarPoints(looseGrammarPoints(source)).slice(0, 4), passageId);
  const draft = source.trim().length >= 80 && /[A-Za-z]{4,}/.test(source);
  if (!draft) return { items: loose, fallback: [], draft: false };
  return { items: [], fallback: loose, draft: true };
}

function draftsToItems(body, passageId, drafts) {
  const used = [];
  const items = [];
  (Array.isArray(drafts) ? drafts : []).forEach((draft) => {
    const place = locatePhrase(body, draft?.phrase, used);
    const distractor = typeof draft?.distractor === "string" ? draft.distractor.trim() : "";
    if (!place || !distractor || distractor.toLowerCase() === place.word.toLowerCase()) return;
    if (/[\[\]/]/.test(distractor)) return;
    used.push([place.start, place.end]);
    items.push({
      ...rankVocabOptions([place.word, distractor], passageId, items.length, 0),
      start: place.start,
      end: place.end,
    });
  });
  items.sort((a, b) => a.start - b.start);
  return items;
}

function shortQuizMessage(body, label) {
  if (String(body || "").trim().length < 40) return `본문이 너무 짧아 ${label} 문제를 만들 수 없습니다.`;
  return `이 본문에서 ${label} 문제를 만들지 못했습니다.`;
}

function quizWaitSection(title, message, action, loading) {
  const retry = action
    ? `<div class="list-actions"><button type="button" class="ghost" data-action="${action}">다시 만들기</button></div>`
    : "";
  return `
    <section class="panel">
      <h2>${esc(title)}</h2>
      <p class="lead">${loading ? `<span class="spinner" aria-hidden="true"></span> ` : ""}${esc(message)}</p>
      ${retry}
    </section>
  `;
}

function quizTokenMatches(kind, token, passageId, body) {
  if (kind === "vocabulary") return token === vocabQuizToken && passageId === vocabPassageId && body === vocabBody;
  return token === grammarQuizToken && passageId === grammarPassageId && body === grammarBody;
}

function applyQuizDraft(kind, items, errorMessage) {
  const picked = kind === "vocabulary"
    ? vocabGraded || Object.keys(vocabPicks).length
    : grammarGraded || Object.keys(grammarPicks).length;
  const current = kind === "vocabulary" ? vocabItems : grammarItems;
  const fallback = kind === "vocabulary" ? vocabFallbackItems : grammarFallbackItems;
  const label = kind === "vocabulary" ? "어휘" : "어법";
  const body = kind === "vocabulary" ? vocabBody : grammarBody;
  let next = items.length ? items : (current.length ? current : fallback);
  if (picked && current.length) next = current;
  if (kind === "vocabulary") vocabItems = next;
  else grammarItems = next;
  const ready = next.length > 0;
  const message = ready ? "" : (errorMessage || shortQuizMessage(body, label));
  if (kind === "vocabulary") {
    vocabQuizState = ready ? "ready" : "error";
    vocabQuizMessage = message;
  } else {
    grammarQuizState = ready ? "ready" : "error";
    grammarQuizMessage = message;
  }
  render();
}

async function loadQuizDraft(kind, passageId, body, token) {
  const key = `${kind}:${token}`;
  if (quizDraftInflight.has(key)) return;
  quizDraftInflight.add(key);
  try {
    const drafts = await draftQuizItems(kind, body);
    if (!quizTokenMatches(kind, token, passageId, body)) return;
    applyQuizDraft(kind, draftsToItems(body, passageId, drafts), "");
  } catch (error) {
    if (!quizTokenMatches(kind, token, passageId, body)) return;
    const message = error instanceof Error ? error.message : "";
    applyQuizDraft(kind, [], message);
  } finally {
    quizDraftInflight.delete(key);
  }
}

function startQuizDraft(kind) {
  if (kind === "vocabulary") {
    if (!vocabDraftPending) return;
    vocabDraftPending = false;
    loadQuizDraft("vocabulary", vocabPassageId, vocabBody, vocabQuizToken);
    return;
  }
  if (!grammarDraftPending) return;
  grammarDraftPending = false;
  loadQuizDraft("grammar", grammarPassageId, grammarBody, grammarQuizToken);
}

function syncVocab(passage) {
  const id = passage?.id || "";
  const body = passage?.body || "";
  if (id === vocabPassageId && body === vocabBody) return;
  vocabPassageId = id;
  vocabBody = body;
  vocabPicks = {};
  vocabGraded = false;
  vocabQuizMessage = "";
  if (!passage) {
    vocabItems = [];
    vocabFallbackItems = [];
    vocabQuizState = "";
    vocabDraftPending = false;
    return;
  }
  const built = buildVocabQuestions(body, id);
  vocabItems = built.items;
  vocabFallbackItems = built.fallback;
  vocabDraftPending = built.draft;
  vocabQuizState = vocabItems.length ? "ready" : (built.draft ? "loading" : "empty");
  vocabQuizMessage = vocabItems.length || built.draft ? "" : shortQuizMessage(body, "어휘");
  if (built.draft) vocabQuizToken += 1;
}

function vocabChoiceClass(index, option) {
  const picked = vocabPicks[index];
  const answer = vocabItems[index]?.answer;
  if (!vocabGraded || !Number.isInteger(picked)) return picked === option ? " is-picked" : "";
  if (picked === option && option === answer) return " is-correct";
  if (picked === option) return " is-wrong";
  if (option === answer) return " is-answer";
  return "";
}

function vocabPassageHtml(body) {
  let html = "";
  let cursor = 0;
  vocabItems.forEach((item, index) => {
    html += esc(body.slice(cursor, item.start));
    const choices = item.options.map((word, option) => (
      `<button type="button" class="vocab-choice${vocabChoiceClass(index, option)}" data-action="pick-vocab" data-vocab="${index}" data-option="${option}" aria-pressed="${vocabPicks[index] === option ? "true" : "false"}">${esc(word)}</button>`
    )).join('<span class="vocab-slash">/</span>');
    html += `<span class="vocab-item"><span class="vocab-num">${index + 1})</span>[${choices}]</span>`;
    cursor = item.end;
  });
  html += esc(body.slice(cursor));
  return html;
}

function vocabScore() {
  const total = vocabItems.length;
  const correct = vocabItems.filter((item, index) => vocabPicks[index] === item.answer).length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, rate };
}

function vocabScoreText(score) {
  return `${score.total}문제 중 ${score.correct}문제 정답 · 정답률 ${score.rate}%`;
}

function focusSentence(body, start, end) {
  const text = String(body || "");
  const fromBreak = Math.max(
    text.lastIndexOf(".", start),
    text.lastIndexOf("!", start),
    text.lastIndexOf("?", start),
    text.lastIndexOf("\n", start),
  );
  const from = fromBreak < 0 ? 0 : fromBreak + 1;
  let to = text.length;
  for (const mark of [".", "!", "?", "\n"]) {
    const at = text.indexOf(mark, end);
    if (at >= 0) to = Math.min(to, at + (mark === "\n" ? 0 : 1));
  }
  return {
    sentence: text.slice(from, to).replace(/\s+/g, " ").trim(),
    focus: text.slice(start, end),
  };
}

function sentenceHtml(body, start, end) {
  const { sentence, focus } = focusSentence(body, start, end);
  if (!sentence) return "";
  const at = focus ? sentence.toLowerCase().indexOf(focus.toLowerCase()) : -1;
  if (at < 0) return esc(sentence);
  return `${esc(sentence.slice(0, at))}<mark>${esc(sentence.slice(at, at + focus.length))}</mark>${esc(sentence.slice(at + focus.length))}`;
}

function grammarRule(kind, answer, wrong) {
  const a = String(answer || "");
  const w = String(wrong || "");
  const al = a.toLowerCase();
  const wl = w.toLowerCase();
  if (kind === "passive") {
    return `수동태는 ‘be동사 + 과거분사’입니다. ‘${a}’는 동작의 대상이 주어일 때 쓰는 형태이고, 과거분사만 있는 ‘${w}’는 be동사가 빠져 수동태가 되지 않습니다.`;
  }
  if (kind === "infinitive") {
    return `to 뒤에는 동사원형이 옵니다. ‘${a}’는 to부정사이고, ‘${w}’는 동명사·분사 형태라 to 바로 뒤에 쓸 수 없습니다.`;
  }
  if (kind === "agreement") {
    return `수일치 문제입니다. 이 자리의 주어에 맞는 동사는 ‘${a}’입니다. ‘${w}’는 주어의 수(단수·복수)와 맞지 않습니다.`;
  }
  if (kind === "conjunction") {
    if (/although|though/i.test(a) && /despite/i.test(w)) {
      return `‘${a}’ 뒤에는 주어와 동사가 있는 절이 옵니다. ‘despite’는 전치사라 뒤에 명사(구)만 옵니다. 뒤를 절이 받으면 although/though가 맞습니다.`;
    }
    if (/despite/i.test(a)) {
      return `‘despite’ 뒤에는 명사(구)가 옵니다. ‘although/though’는 접속사라 뒤에 절이 와야 하므로 이 자리와 맞지 않습니다.`;
    }
    if (/because of/i.test(a)) {
      return `‘because of’ 뒤에는 명사(구)가 옵니다. ‘because’는 접속사라 뒤에 절(주어+동사)이 와야 합니다.`;
    }
    if (al === "because") {
      return `‘because’ 뒤에는 주어와 동사가 있는 절이 옵니다. ‘because of’는 전치사구라 뒤에 명사만 받습니다.`;
    }
    return `접속사와 전치사는 뒤에 오는 말의 형태가 다릅니다. 이 문맥에서는 ‘${a}’가 맞고 ‘${w}’는 뒤 구조와 맞지 않습니다.`;
  }
  if (kind === "relative") {
    if (/\s/.test(a) && /which|whom/i.test(a)) {
      const prep = a.split(/\s+/)[0];
      return `전치사와 관계대명사가 함께 쓰입니다. ‘${a}’처럼 전치사 ‘${prep}’를 관계사 앞에 두어야 관계절이 앞 명사와 맺는 관계가 드러납니다. 관계대명사만 있는 ‘${w}’는 그 전치사가 빠집니다.`;
    }
    if (al === "whose" || wl === "who's") {
      return `‘whose’는 ‘~의’라는 소유의 관계대명사입니다. ‘who's’는 who is 또는 who has의 줄임말이라 소유를 나타내지 못합니다.`;
    }
    if (al === "whom") {
      return `‘whom’은 목적격 관계대명사로, 관계절 안에서 목적어 역할을 할 때 씁니다. ‘who’는 주격이라 이 자리와 맞지 않습니다.`;
    }
    if (al === "who") {
      return `‘who’는 사람을 받는 주격 관계대명사입니다. ‘${w}’는 사물을 받거나 이 절의 역할과 다릅니다.`;
    }
    if (al === "which") {
      return `‘which’는 사물이나 앞의 내용(절)을 받습니다. ‘who’는 사람이 선행사일 때 쓰므로 이 자리와 다릅니다.`;
    }
    if (al === "that" && wl === "what") {
      return `‘that’은 앞에 나온 명사를 받는 관계대명사입니다. ‘what’은 선행사를 포함한 말이라 앞에 명사가 이미 있으면 쓸 수 없습니다.`;
    }
    if (al === "where") {
      return `‘where’는 장소의 관계부사로, ‘전치사 + which’의 뜻을 대신합니다. ‘which’만 쓰면 장소의 부사 역할이 되지 않습니다.`;
    }
    if (al === "when") {
      return `‘when’은 시간의 관계부사입니다. ‘where’는 장소를 받으므로 시간 표현 뒤에는 맞지 않습니다.`;
    }
    return `관계사는 앞 말(선행사)과 절 안에서의 역할에 맞게 고릅니다. 여기서는 ‘${a}’가 맞고 ‘${w}’는 선행사나 격이 다릅니다.`;
  }
  if (kind === "participle") {
    const answerIng = /ing$/i.test(al);
    const wrongIng = /ing$/i.test(wl);
    if (answerIng && !wrongIng) {
      return `현재분사 ‘${a}’는 능동·진행의 의미입니다. 그 말의 주체가 동작을 직접 할 때 -ing를 씁니다. 과거분사 ‘${w}’는 수동·완료라 방향이 반대입니다.`;
    }
    if (!answerIng && wrongIng) {
      return `과거분사 ‘${a}’는 수동·완료의 의미입니다. 명사가 동작의 대상이거나, 이미 일어난 결과·감정일 때 과거분사를 씁니다. 현재분사 ‘${w}’는 능동이라 이 자리와 맞지 않습니다.`;
    }
    return `분사 자리입니다. 문맥에 맞는 형태는 ‘${a}’이고, ‘${w}’는 능동과 수동의 방향이 다릅니다.`;
  }
  if (kind === "loose") {
    return `수의 형태가 갈립니다. 본문은 ‘${a}’를 쓰고, ‘${w}’는 단수·복수가 달라 이 문장의 주어나 목적어와 호응하지 않습니다.`;
  }
  return `어법상 이 자리에는 ‘${a}’가 맞습니다. ‘${w}’는 형태나 문장 성분이 달라 같은 자리에 쓸 수 없습니다. 밑줄이 있는 문장에서 주어와 동사, 수식 관계를 다시 확인하세요.`;
}

const GRAMMAR_POINT_LABEL = {
  passive: "수동태",
  relative: "관계사",
  infinitive: "to부정사",
  agreement: "수일치",
  conjunction: "접속사·전치사",
  participle: "분사",
  loose: "수 일치",
  confusable: "헷갈리는 어휘",
  context: "문맥상 어휘",
};

function choiceExplainHtml(items, body, title, lead) {
  const cards = items.map((item, index) => {
    const answer = item.options[item.answer] || "";
    const wrong = item.options.filter((_, option) => option !== item.answer);
    const wrongText = wrong.map((word) => `‘${word}’`).join(", ");
    const label = GRAMMAR_POINT_LABEL[item.point] || (title.startsWith("어휘") ? "문맥상 어휘" : "어법");
    const rule = title.startsWith("어휘")
      ? vocabRule(item, answer, wrong, wrongText)
      : grammarRule(item.point, answer, wrong[0] || "");
    return `
      <li class="explain-item">
        <h3>${index + 1}번</h3>
        <p class="explain-kicker">${esc(label)}</p>
        <p class="explain-answer">정답 ${esc(answer)}</p>
        <p class="explain-body">${esc(rule)}</p>
        <p class="explain-sentence" lang="en">${sentenceHtml(body, item.start, item.end)}</p>
      </li>
    `;
  }).join("");
  return explainSheet(title, lead, `<ol class="explain-list">${cards}</ol>`);
}

function vocabRule(item, answer, wrong, wrongText) {
  if (item.point === "confusable") {
    return `‘${answer}’와 ${wrongText}는 철자나 뜻이 비슷해 세트로 출제됩니다. 문장이 실제로 말하는 대상·태도·결과에 맞는 말은 ‘${answer}’입니다. ${wrongText}를 넣으면 앞뒤 논리(원인과 결과, 긍정과 부정)가 뒤집히거나 어색해집니다.`;
  }
  if (wrong.length > 1) {
    return `괄호 속 표현 가운데 글의 흐름과 맞는 말은 ‘${answer}’입니다. ${wrongText}는 품사는 비슷해 보여도 이 문장이 요구하는 의미와 다릅니다. 빈칸 앞뒤의 단서(지시 대상, 원인, 대조)를 기준으로 고릅니다.`;
  }
  return `빈칸의 정답은 ‘${answer}’입니다. ${wrongText || "다른 선택지"}는 난이도가 비슷한 다른 단어일 뿐, 이 문장이 설명하는 내용과 맞지 않습니다. 정답을 넣은 문장은 앞 문장의 주제를 자연스럽게 이어 받습니다.`;
}

function orderLink(sentence, index) {
  const text = String(sentence || "").trim();
  if (index === 0) return "글이 시작되는 문장입니다. 주제나 상황을 먼저 꺼내므로 맨 앞에 둡니다.";
  if (/^(however|nevertheless|nonetheless|on the other hand|by contrast|in contrast|yet|but)\b/i.test(text)) {
    return "앞 내용과 반대되거나 방향을 바꿉니다. 주장이나 상황이 나온 바로 뒤에 옵니다.";
  }
  if (/^(therefore|thus|hence|consequently|as a result|so)\b/i.test(text)) {
    return "앞에서 말한 내용의 결과입니다. 원인 문장 다음에 둡니다.";
  }
  if (/^(for example|for instance)\b/i.test(text)) {
    return "앞 문장을 예로 풀어 줍니다. 일반적인 설명 바로 뒤에 옵니다.";
  }
  if (/^(in addition|moreover|furthermore|also|besides)\b/i.test(text)) {
    return "앞 내용에 같은 방향의 정보를 더합니다.";
  }
  if (/^(this|that|these|those|such|it|they|he|she|we)\b/i.test(text)) {
    return "앞 문장에 나온 대상을 가리키는 말로 시작합니다. 그 대상이 먼저 나온 뒤에 와야 합니다.";
  }
  return "앞 문장의 내용을 이어서 구체화하거나 다음 단계로 넘깁니다.";
}

function orderExplainHtml() {
  const cards = orderItems.map((item, question) => {
    const sequence = orderLetters(item);
    const steps = item.sentences.map((sentence, original) => {
      const letter = orderLetter(item.shuffled.indexOf(original));
      return `<li><strong>(${letter})</strong> ${esc(sentence)}<span class="explain-why">${esc(orderLink(sentence, original))}</span></li>`;
    }).join("");
    return `
      <li class="explain-item">
        <h3>${question + 1}번</h3>
        <p class="explain-answer">정답 ${esc(sequence.join("-"))}</p>
        <p class="explain-body">괄호의 알파벳은 문제지에 적힌 기호입니다. 아래는 글이 읽히는 순서와, 각 문장이 그 자리에 오는 이유입니다.</p>
        <ol class="explain-flow">${steps}</ol>
      </li>
    `;
  }).join("");
  return explainSheet("문장 배열 해설", "모든 문제의 정답 순서와 흐름입니다.", `<ol class="explain-list">${cards}</ol>`);
}

function insertWhy(given, before, after) {
  const text = String(given || "").trim();
  const parts = [];
  if (/^(however|nevertheless|nonetheless|on the other hand|yet|but)\b/i.test(text)) {
    parts.push("주어진 문장은 앞 내용과 대조됩니다. 반대되는 내용이 끝난 뒤, 화제가 다시 넘어가기 전에 넣습니다.");
  } else if (/^(therefore|thus|hence|consequently|as a result)\b/i.test(text)) {
    parts.push("주어진 문장은 앞의 원인에 대한 결과입니다. 그 원인이 나온 직후에 넣습니다.");
  } else if (/^(for example|for instance)\b/i.test(text)) {
    parts.push("주어진 문장은 앞 문장의 예시입니다. 일반적인 설명이 끝난 뒤에 넣습니다.");
  } else if (/^(this|that|these|those|such|it|they|he|she|we)\b/i.test(text)) {
    parts.push("주어진 문장은 지시어로 시작합니다. 가리키는 대상이 바로 앞 문장에 있어야 합니다.");
  } else if (/^(in addition|moreover|furthermore|also|besides)\b/i.test(text)) {
    parts.push("주어진 문장은 앞 내용에 같은 방향의 정보를 보탭니다. 그 내용이 나온 직후에 넣습니다.");
  } else {
    parts.push("주어진 문장은 앞 문장을 받아 내용을 이어 가고, 뒤 문장이 그 다음 단계로 넘어가게 합니다.");
  }
  if (before) parts.push(`바로 앞에서는 “${before}”라고 말한 뒤입니다.`);
  else parts.push("이 자리는 제시된 글의 맨 앞입니다. 주어진 문장이 뒤에 올 문장들의 전제가 됩니다.");
  if (after) parts.push(`바로 뒤는 “${after}”로 이어집니다.`);
  else parts.push("이 자리는 제시된 글의 마지막입니다. 주어진 문장이 앞 내용을 마무리합니다.");
  return parts.join(" ");
}

function insertExplainHtml() {
  const cards = insertItems.map((item, question) => {
    const mark = INSERT_MARKS[item.answer] || String(item.answer + 1);
    const before = item.answer > 0 ? item.rest[item.answer - 1] : "";
    const after = item.answer < item.rest.length ? item.rest[item.answer] : "";
    const rebuilt = [];
    item.rest.forEach((sentence, index) => {
      if (index === item.answer) rebuilt.push({ given: true, sentence: item.given });
      rebuilt.push({ given: false, sentence });
    });
    if (item.answer >= item.rest.length) rebuilt.push({ given: true, sentence: item.given });
    const flow = rebuilt.map((row) => `<li class="${row.given ? "is-given" : ""}">${row.given ? "<strong>주어진 문장. </strong>" : ""}${esc(row.sentence)}</li>`).join("");
    return `
      <li class="explain-item">
        <h3>${question + 1}번</h3>
        <p class="explain-answer">정답 ${esc(mark)}</p>
        <p class="explain-sentence" lang="en">${esc(item.given)}</p>
        <p class="explain-body">${esc(insertWhy(item.given, before, after))}</p>
        <ol class="explain-flow">${flow}</ol>
      </li>
    `;
  }).join("");
  return explainSheet("문장 삽입 해설", "모든 문제의 정답 위치와, 그 자리에서 앞뒤가 어떻게 이어지는지입니다.", `<ol class="explain-list">${cards}</ol>`);
}

function quizPaneScroll() {
  const pane = viewEl.querySelector(".quiz-split-main");
  if (pane && viewEl.querySelector(".quiz-layout.is-split")) return pane.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function restoreQuizScroll(top) {
  const pane = viewEl.querySelector(".quiz-split-main");
  if (pane && viewEl.querySelector(".quiz-layout.is-split")) {
    pane.scrollTop = top;
    return;
  }
  window.scrollTo(0, top);
}

function explainSheet(title, lead, list) {
  return `
    <aside class="explain-pane" aria-labelledby="explain-title">
      <div class="explain-bar-head">
        <div>
          <h2 id="explain-title">${esc(title)}</h2>
          <p>${esc(lead)}</p>
        </div>
        <button type="button" class="ghost" data-action="close-explain">닫기</button>
      </div>
      ${list}
    </aside>
  `;
}

function explainButton(kind) {
  const open = explainQuiz === kind;
  return `
    <div class="explain-bar">
      <button type="button" class="explain-open" data-action="show-explain" data-quiz="${kind}" aria-expanded="${open ? "true" : "false"}">해설 보기</button>
    </div>
  `;
}

function activeExplainHtml() {
  if (explainQuiz === "vocabulary") {
    return choiceExplainHtml(vocabItems, vocabBody, "어휘 고르기 해설", "이 탭에 나온 모든 문제의 정답과 해설입니다.");
  }
  if (explainQuiz === "grammar") {
    return choiceExplainHtml(grammarItems, grammarBody, "어법 고르기 해설", "이 탭에 나온 모든 문제의 정답과 해설입니다.");
  }
  if (explainQuiz === "order") return orderExplainHtml();
  if (explainQuiz === "insert") return insertExplainHtml();
  return "";
}

function vocabularySection(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    syncVocab(null);
    return `
      <section class="panel">
        <h2>어휘 고르기</h2>
        <p class="lead">공부할 본문을 고르면 [ 어휘1 / 어휘2 ] 문제를 풀 수 있습니다.</p>
      </section>
    `;
  }
  syncVocab(current);
  const score = vocabGraded ? vocabScore() : null;
  if (!vocabItems.length) {
    const loading = vocabQuizState === "loading";
    const action = loading || current.body.trim().length < 40 ? "" : "retry-vocab-quiz";
    const message = loading ? "본문을 분석해 어휘 문제를 만들고 있습니다." : vocabQuizMessage;
    return quizWaitSection(current.title, message, action, loading);
  }
  return `
    <section class="panel vocab-quiz">
      <div class="between">
        <h2>${esc(current.title)}</h2>
        ${score ? `<p class="vocab-score">${esc(vocabScoreText(score))}</p>` : `<p class="tiny">${vocabItems.length}문제</p>`}
      </div>
      <p class="lead">괄호 안에서 문맥에 맞는 단어를 고르세요. 고른 단어에 동그라미가 표시됩니다.</p>
      <div class="vocab-passage" lang="en">${vocabPassageHtml(current.body)}</div>
      ${score ? `<p class="vocab-score-banner" role="status">${esc(vocabScoreText(score))}</p>` : ""}
      <div class="list-actions">
        <button type="button" class="pill" data-action="grade-vocab"${vocabGraded ? " disabled" : ""}>채점하기</button>
        <button type="button" class="ghost" data-action="reset-vocab">다시 풀기</button>
      </div>
      ${explainButton("vocabulary")}
    </section>
  `;
}

function syncGrammar(passage) {
  const id = passage?.id || "";
  const body = passage?.body || "";
  if (id === grammarPassageId && body === grammarBody) return;
  grammarPassageId = id;
  grammarBody = body;
  grammarPicks = {};
  grammarGraded = false;
  grammarQuizMessage = "";
  if (!passage) {
    grammarItems = [];
    grammarFallbackItems = [];
    grammarQuizState = "";
    grammarDraftPending = false;
    return;
  }
  const built = buildGrammarQuestions(body, id);
  grammarItems = built.items;
  grammarFallbackItems = built.fallback;
  grammarDraftPending = built.draft;
  grammarQuizState = grammarItems.length ? "ready" : (built.draft ? "loading" : "empty");
  grammarQuizMessage = grammarItems.length || built.draft ? "" : shortQuizMessage(body, "어법");
  if (built.draft) grammarQuizToken += 1;
}

function grammarChoiceClass(index, option) {
  const picked = grammarPicks[index];
  const answer = grammarItems[index]?.answer;
  if (!grammarGraded || !Number.isInteger(picked)) return picked === option ? " is-picked" : "";
  if (picked === option && option === answer) return " is-correct";
  if (picked === option) return " is-wrong";
  if (option === answer) return " is-answer";
  return "";
}

function grammarPassageHtml(body) {
  let html = "";
  let cursor = 0;
  grammarItems.forEach((item, index) => {
    html += esc(body.slice(cursor, item.start));
    const choices = item.options.map((word, option) => (
      `<button type="button" class="vocab-choice${grammarChoiceClass(index, option)}" data-action="pick-grammar" data-grammar="${index}" data-option="${option}" aria-pressed="${grammarPicks[index] === option ? "true" : "false"}">${esc(word)}</button>`
    )).join('<span class="vocab-slash">/</span>');
    html += `<span class="vocab-item"><span class="vocab-num">${index + 1})</span>[${choices}]</span>`;
    cursor = item.end;
  });
  html += esc(body.slice(cursor));
  return html;
}

function grammarScore() {
  const total = grammarItems.length;
  const correct = grammarItems.filter((item, index) => grammarPicks[index] === item.answer).length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, rate };
}

function grammarSection(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    syncGrammar(null);
    return `
      <section class="panel">
        <h2>어법 고르기</h2>
        <p class="lead">공부할 본문을 고르면 [ 어법1 / 어법2 ] 문제를 풀 수 있습니다.</p>
      </section>
    `;
  }
  syncGrammar(current);
  const score = grammarGraded ? grammarScore() : null;
  if (!grammarItems.length) {
    const loading = grammarQuizState === "loading";
    const action = loading || current.body.trim().length < 40 ? "" : "retry-grammar-quiz";
    const message = loading ? "본문을 분석해 어법 문제를 만들고 있습니다." : grammarQuizMessage;
    return quizWaitSection(current.title, message, action, loading);
  }
  return `
    <section class="panel vocab-quiz">
      <div class="between">
        <h2>${esc(current.title)}</h2>
        ${score ? `<p class="vocab-score">${esc(vocabScoreText(score))}</p>` : `<p class="tiny">${grammarItems.length}문제</p>`}
      </div>
      <p class="lead">괄호 안에서 어법에 맞는 표현을 고르세요. 고른 표현에 동그라미가 표시됩니다.</p>
      <div class="vocab-passage" lang="en">${grammarPassageHtml(current.body)}</div>
      ${score ? `<p class="vocab-score-banner" role="status">${esc(vocabScoreText(score))}</p>` : ""}
      <div class="list-actions">
        <button type="button" class="pill" data-action="grade-grammar"${grammarGraded ? " disabled" : ""}>채점하기</button>
        <button type="button" class="ghost" data-action="reset-grammar">다시 풀기</button>
      </div>
      ${explainButton("grammar")}
    </section>
  `;
}

function stableOrder(length, key) {
  const items = Array.from({ length }, (_, index) => index);
  items.sort((a, b) => (stableRank(`${key}:${a}`) - stableRank(`${key}:${b}`)) || (a - b));
  if (length > 1 && items.every((value, index) => value === index)) {
    [items[0], items[1]] = [items[1], items[0]];
  }
  return items;
}

function orderLetter(index) {
  return String.fromCharCode(65 + index);
}

function orderQuestions(body, passageId) {
  const sentences = splitSentences(body);
  if (sentences.length < 3) return [];
  const chunks = [];
  const size = sentences.length <= 12 ? sentences.length : 7;
  let index = 0;
  while (index < sentences.length) {
    const remain = sentences.length - index;
    if (remain < 3) {
      if (!chunks.length) break;
      const last = chunks[chunks.length - 1];
      last.sentences.push(...sentences.slice(index));
      last.shuffled = stableOrder(last.sentences.length, `${passageId}:order:${index}`);
      break;
    }
    const take = Math.min(size, remain);
    chunks.push({
      sentences: sentences.slice(index, index + take),
      shuffled: stableOrder(take, `${passageId}:order:${index}`),
    });
    index += take;
  }
  return chunks;
}

function orderLetters(item) {
  return item.sentences.map((_, original) => orderLetter(item.shuffled.indexOf(original)));
}

function readOrderAnswers() {
  document.querySelectorAll("[data-order-answer]").forEach((field) => {
    orderPicks[Number(field.dataset.orderAnswer)] = field.value;
  });
}

function parseOrderAnswer(value) {
  return String(value || "").toUpperCase().match(/[A-Z]/g) || [];
}

function syncOrder(passage) {
  const id = passage?.id || "";
  const body = passage?.body || "";
  if (id === orderPassageId && body === orderBody) return;
  orderPassageId = id;
  orderBody = body;
  orderItems = passage ? orderQuestions(body, id) : [];
  orderPicks = {};
  orderItems.forEach((_, index) => {
    orderPicks[index] = "";
  });
  orderGraded = false;
}

function orderCorrect(question) {
  const expected = orderLetters(orderItems[question]);
  const given = parseOrderAnswer(orderPicks[question]);
  return given.length === expected.length && given.every((letter, index) => letter === expected[index]);
}

function orderScore() {
  const total = orderItems.length;
  const correct = orderItems.filter((_, index) => orderCorrect(index)).length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, rate };
}

function orderSection(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    syncOrder(null);
    return `
      <section class="panel">
        <h2>문장 배열</h2>
        <p class="lead">공부할 본문을 고르면 문장을 올바른 순서로 배열하는 문제를 풀 수 있습니다.</p>
      </section>
    `;
  }
  syncOrder(current);
  const score = orderGraded ? orderScore() : null;
  if (!orderItems.length) {
    return `
      <section class="panel">
        <h2>${esc(current.title)}</h2>
        <p class="lead">문장 배열을 만들려면 본문에 문장이 세 개 이상 있어야 합니다.</p>
      </section>
    `;
  }
  const questions = orderItems.map((item, question) => {
    const rows = item.shuffled.map((source, index) => `
      <li><span>(${orderLetter(index)})</span><p>${esc(item.sentences[source])}</p></li>
    `).join("");
    const mark = orderGraded ? (orderCorrect(question) ? " is-correct" : " is-wrong") : "";
    const answer = orderGraded && !orderCorrect(question)
      ? `<p class="order-answer">정답: ${orderLetters(item).join("-")}</p>`
      : "";
    return `
      <article class="order-sheet">
        <div class="order-head">
          <h2>Q. 문맥 상 다음 문장들의 적절한 순서를 쓰시오.</h2>
          <p class="order-source">${question + 1}. [${esc(current.title)}]</p>
        </div>
        <ol class="order-sentences">${rows}</ol>
        <label class="order-write">순서
          <input type="text" class="order-input${mark}" data-order-answer="${question}" value="${esc(orderPicks[question] || "")}" placeholder="A-B-C-D" autocomplete="off"${orderGraded ? " disabled" : ""}>
        </label>
        ${answer}
      </article>
    `;
  }).join("");
  return `
    <section class="panel vocab-quiz">
      ${questions}
      ${score ? `<p class="vocab-score-banner" role="status">${esc(vocabScoreText(score))}</p>` : ""}
      <div class="list-actions">
        <button type="button" class="pill" data-action="grade-order"${orderGraded ? " disabled" : ""}>채점하기</button>
        <button type="button" class="ghost" data-action="reset-order">다시 풀기</button>
      </div>
      ${explainButton("order")}
    </section>
  `;
}

const INSERT_MARKS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

function insertionWindow(sentences, removed) {
  return {
    given: sentences[removed],
    rest: sentences.filter((_, index) => index !== removed),
    answer: removed,
  };
}

function insertionQuestions(body, passageId) {
  const sentences = splitSentences(body);
  if (sentences.length < 4) return [];
  const target = 3;
  if (sentences.length >= target * 4) {
    const width = Math.min(6, Math.floor(sentences.length / target));
    const questions = [];
    let cursor = 0;
    while (questions.length < target && cursor + 4 <= sentences.length) {
      const take = Math.min(width, sentences.length - cursor);
      if (take < 4) break;
      const window = sentences.slice(cursor, cursor + take);
      const candidates = [];
      for (let index = 1; index < window.length - 1; index += 1) candidates.push(index);
      const removed = candidates[Math.abs(stableRank(`${passageId}:insert:${cursor}`)) % candidates.length];
      questions.push(insertionWindow(window, removed));
      cursor += take;
    }
    return questions;
  }
  const width = Math.min(6, sentences.length);
  const window = sentences.slice(0, width);
  const interior = [];
  for (let index = 1; index < window.length - 1; index += 1) interior.push(index);
  const pool = interior.length >= target ? interior : window.map((_, index) => index);
  const order = stableOrder(pool.length, `${passageId}:insert-pick`);
  const count = Math.min(target, pool.length);
  const questions = [];
  for (let step = 0; step < count; step += 1) {
    questions.push(insertionWindow(window, pool[order[step]]));
  }
  return questions;
}

function syncInsert(passage) {
  const id = passage?.id || "";
  const body = passage?.body || "";
  if (id === insertPassageId && body === insertBody) return;
  insertPassageId = id;
  insertBody = body;
  insertItems = passage ? insertionQuestions(body, id) : [];
  insertPicks = {};
  insertGraded = false;
}

function insertChoiceClass(question, option) {
  const picked = insertPicks[question];
  const answer = insertItems[question]?.answer;
  if (!insertGraded || !Number.isInteger(picked)) return picked === option ? " is-picked" : "";
  if (picked === option && option === answer) return " is-correct";
  if (picked === option) return " is-wrong";
  if (option === answer) return " is-answer";
  return "";
}

function insertPassageHtml(item, question) {
  const marked = item.rest.map((sentence, index) => {
    const pressed = insertPicks[question] === index ? "true" : "false";
    return `<button type="button" class="insert-mark${insertChoiceClass(question, index)}" data-action="pick-insert" data-question="${question}" data-option="${index}" aria-pressed="${pressed}">${INSERT_MARKS[index]}</button> ${esc(sentence)}`;
  }).join(" ");
  const last = item.rest.length;
  const pressed = insertPicks[question] === last ? "true" : "false";
  return `${marked} <button type="button" class="insert-mark${insertChoiceClass(question, last)}" data-action="pick-insert" data-question="${question}" data-option="${last}" aria-pressed="${pressed}">${INSERT_MARKS[last]}</button>`;
}

function insertScore() {
  const total = insertItems.length;
  const correct = insertItems.filter((item, index) => insertPicks[index] === item.answer).length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, rate };
}

function insertSection(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    syncInsert(null);
    return `
      <section class="panel">
        <h2>문장 삽입</h2>
        <p class="lead">공부할 본문을 고르면 주어진 문장이 들어갈 위치를 고르는 문제를 풀 수 있습니다.</p>
      </section>
    `;
  }
  syncInsert(current);
  const score = insertGraded ? insertScore() : null;
  if (!insertItems.length) {
    return `
      <section class="panel">
        <h2>${esc(current.title)}</h2>
        <p class="lead">문장 삽입을 만들려면 본문에 문장이 네 개 이상 있어야 합니다.</p>
      </section>
    `;
  }
  const questions = insertItems.map((item, question) => `
    <article class="quiz-block">
      <p class="tiny">${question + 1}번</p>
      <p class="insert-given"><span>주어진 문장</span>${esc(item.given)}</p>
      <div class="insert-passage" lang="en">${insertPassageHtml(item, question)}</div>
    </article>
  `).join("");
  return `
    <section class="panel vocab-quiz">
      <div class="between">
        <h2>${esc(current.title)}</h2>
        ${score ? `<p class="vocab-score">${esc(vocabScoreText(score))}</p>` : `<p class="tiny">${insertItems.length}문제</p>`}
      </div>
      <p class="lead">주어진 문장이 들어가기에 가장 적절한 곳을 고르세요.</p>
      ${questions}
      ${score ? `<p class="vocab-score-banner" role="status">${esc(vocabScoreText(score))}</p>` : ""}
      <div class="list-actions">
        <button type="button" class="pill" data-action="grade-insert"${insertGraded ? " disabled" : ""}>채점하기</button>
        <button type="button" class="ghost" data-action="reset-insert">다시 풀기</button>
      </div>
      ${explainButton("insert")}
    </section>
  `;
}

const WRITTEN_STOP = new Set("the a an and or but if to of in on for with as at by from that this these those is are was were be been being it its their his her they he she we you i not than then into about after before over under which who whom whose have has had do does did can could will would may might must".split(" "));

function writtenWords(sentence) {
  return String(sentence || "")
    .replace(/[^A-Za-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !WRITTEN_STOP.has(word.toLowerCase()));
}

function fallbackWrittenItems(body) {
  const sentences = splitSentences(body).filter((sentence) => sentence.split(/\s+/).length >= 6);
  if (sentences.length < 2) return [];
  const key = sentences[Math.min(1, sentences.length - 1)];
  const condition = sentences.find((sentence) => sentence !== key) || sentences[0];
  const keyWords = writtenWords(key).slice(0, 4);
  const conditionWords = writtenWords(condition).slice(0, 3);
  const summary = [sentences[0], sentences[sentences.length - 1]]
    .filter((sentence, index, list) => sentence && list.indexOf(sentence) === index)
    .join(" ");
  return [
    {
      type: "key",
      title: "핵심 문장 영작",
      prompt: "제시한 단어를 모두 넣어, 그 단어들이 본문에서 말하는 내용을 영어 한 문장으로 쓰세요.",
      conditions: ["영어 한 문장으로 쓸 것", "제시한 단어를 모두 사용할 것", "본문의 내용과 어긋나지 않을 것"],
      keywords: keyWords.length ? keyWords : key.split(/\s+/).slice(0, 4),
      model: key,
    },
    {
      type: "condition",
      title: "조건 영작",
      prompt: "다음 조건에 맞춰 본문의 해당 내용을 영어 한 문장으로 쓰세요.",
      conditions: [
        conditionWords.length ? `다음 단어를 모두 사용할 것: ${conditionWords.join(", ")}` : "본문의 핵심 단어를 사용할 것",
        "영어 한 문장으로 쓸 것",
        "본문의 의미와 같게 쓸 것",
      ],
      keywords: conditionWords,
      model: condition,
    },
    {
      type: "summary",
      title: "내용 요약",
      prompt: "본문 전체의 내용을 영어 두 문장 이내로 요약하세요.",
      conditions: ["영어 두 문장 이내로 쓸 것", "주제와 핵심 근거를 포함할 것"],
      keywords: writtenWords(sentences[0]).slice(0, 4),
      model: summary,
    },
  ];
}

function syncWritten(passage) {
  const id = passage?.id || "";
  const body = passage?.body || "";
  if (id === writtenPassageId && body === writtenBody) return;
  writtenPassageId = id;
  writtenBody = body;
  writtenBusy = -1;
  writtenMessage = "";
  writtenSource = "";
  if (!passage) {
    writtenItems = [];
    writtenAnswers = [];
    writtenFeedback = [];
    writtenState = "";
    writtenPending = false;
    return;
  }
  const local = fallbackWrittenItems(body);
  writtenItems = local;
  writtenAnswers = local.map(() => "");
  writtenFeedback = local.map(() => null);
  const canAsk = body.trim().length >= 80 && /[A-Za-z]{4,}/.test(body);
  writtenPending = canAsk;
  writtenSource = local.length ? "local" : "";
  writtenState = local.length ? "ready" : (canAsk ? "loading" : "empty");
  writtenMessage = local.length || canAsk ? "" : "본문이 너무 짧아 서술형 문제를 만들 수 없습니다.";
  if (canAsk) writtenToken += 1;
}

function applyWritten(items, errorMessage) {
  const touched = writtenAnswers.some((answer) => String(answer || "").trim())
    || writtenFeedback.some((item) => item && !item.error);
  let changed = false;
  if (!touched && items.length) {
    writtenItems = items;
    writtenAnswers = items.map(() => "");
    writtenFeedback = items.map(() => null);
    writtenState = "ready";
    writtenMessage = "";
    writtenSource = "ai";
    changed = true;
  } else if (!writtenItems.length) {
    writtenState = "error";
    writtenMessage = errorMessage || "서술형 문제를 만들지 못했습니다.";
    changed = true;
  } else if (errorMessage && writtenSource !== "ai") {
    const next = "AI로 다시 만들지 못해 본문 문장으로 만든 문제를 유지합니다.";
    if (writtenMessage !== next) {
      writtenMessage = next;
      writtenState = "ready";
      changed = true;
    }
  }
  if (changed) render();
}

async function loadWritten(passageId, body, token) {
  const key = `written:${token}`;
  if (writtenInflight.has(key)) return;
  writtenInflight.add(key);
  try {
    const items = await draftWrittenItems(body);
    if (token !== writtenToken || passageId !== writtenPassageId || body !== writtenBody) return;
    applyWritten(items, "");
  } catch (error) {
    if (token !== writtenToken || passageId !== writtenPassageId || body !== writtenBody) return;
    applyWritten([], error instanceof Error ? error.message : "");
  } finally {
    writtenInflight.delete(key);
  }
}

function startWritten() {
  if (!writtenPending) return;
  writtenPending = false;
  loadWritten(writtenPassageId, writtenBody, writtenToken);
}

async function submitWritten(index) {
  const item = writtenItems[index];
  const answer = String(writtenAnswers[index] || "").trim();
  if (!item || !answer || writtenBusy >= 0) return;
  const token = writtenToken;
  const passageId = writtenPassageId;
  writtenBusy = index;
  writtenFeedback[index] = null;
  render();
  try {
    const review = await reviewWrittenAnswer({
      passage: writtenBody,
      prompt: item.prompt,
      conditions: item.conditions,
      keywords: item.keywords,
      model: item.model,
      answer,
    });
    if (token !== writtenToken || passageId !== writtenPassageId) return;
    writtenFeedback[index] = review;
  } catch (error) {
    if (token !== writtenToken || passageId !== writtenPassageId) return;
    writtenFeedback[index] = {
      error: error instanceof Error ? error.message : "답안을 분석하지 못했습니다.",
    };
  } finally {
    if (token === writtenToken && passageId === writtenPassageId) {
      writtenBusy = -1;
      render();
    }
  }
}

function writtenMeterClass(score) {
  if (score >= 80) return " is-high";
  if (score >= 50) return " is-mid";
  return " is-low";
}

function writtenFeedbackHtml(item, feedback) {
  if (!feedback) return "";
  if (feedback.error) return `<p class="written-error" role="alert">${esc(feedback.error)}</p>`;
  return `
    <div class="written-feedback" role="status">
      <div class="written-score-row">
        <p>${feedback.score}% 일치</p>
        <div class="written-meter${writtenMeterClass(feedback.score)}" role="meter" aria-valuenow="${feedback.score}" aria-valuemin="0" aria-valuemax="100" aria-label="모범 답안 일치율 ${feedback.score}%">
          <span style="width:${feedback.score}%"></span>
        </div>
      </div>
      <h3>칭찬 및 분석</h3>
      <p>${esc(feedback.praise)}</p>
      <p class="written-gap">${esc(feedback.gap)}</p>
      <h3>모범 답안</h3>
      <p class="written-model" lang="en">${esc(item.model)}</p>
      <h3>추천 수정안</h3>
      <p class="written-revision" lang="en">${esc(feedback.revision)}</p>
    </div>
  `;
}

function writtenSection(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    syncWritten(null);
    return `
      <section class="panel" aria-label="서술형">
        <h2>서술형</h2>
        <p class="lead">공부할 본문을 고르면 핵심 문장 영작, 조건 영작, 내용 요약 문제를 풀 수 있습니다.</p>
      </section>
    `;
  }
  syncWritten(current);
  if (!writtenItems.length) {
    const loading = writtenState === "loading";
    return quizWaitSection(
      current.title,
      loading ? "본문을 분석해 서술형 문제를 만들고 있습니다." : (writtenMessage || "서술형 문제를 만들지 못했습니다."),
      writtenState === "error" ? "retry-written" : "",
      loading,
    );
  }
  const questions = writtenItems.map((item, index) => {
    const feedback = writtenFeedback[index];
    const busy = writtenBusy === index;
    const done = feedback && !feedback.error;
    return `
      <article class="quiz-block written-question">
        <p class="written-kicker">${esc(item.title)}</p>
        <h3>${index + 1}. ${esc(item.prompt)}</h3>
        <ul class="written-conditions">
          ${item.conditions.map((condition) => `<li>${esc(condition)}</li>`).join("")}
        </ul>
        <label class="field">내 답안
          <textarea class="plain-text" rows="4" lang="en" data-field="written-answer" data-index="${index}" placeholder="영어 답안을 적으세요." ${busy ? "disabled" : ""}>${esc(writtenAnswers[index] || "")}</textarea>
        </label>
        <div class="list-actions">
          <button type="button" class="pill" data-action="submit-written" data-index="${index}" ${busy ? "disabled" : ""}>${busy ? "분석 중" : done ? "다시 피드백 받기" : "제출 및 피드백 받기"}</button>
        </div>
        ${busy ? `<p class="tiny"><span class="spinner" aria-hidden="true"></span> 의미, 문법, 핵심 표현을 비교하고 있습니다.</p>` : ""}
        ${writtenFeedbackHtml(item, feedback)}
      </article>
    `;
  }).join("");
  return `
    <section class="panel written-quiz" aria-label="서술형">
      <div class="between">
        <h2>${esc(current.title)}</h2>
        <p class="tiny">${writtenItems.length}문제</p>
      </div>
      <p class="lead">답안을 제출하면 모범 답안과의 일치율, 잘한 점, 고칠 점, 추천 수정안을 보여 줍니다.</p>
      ${writtenMessage ? `<p class="tiny" role="status">${esc(writtenMessage)}</p>` : ""}
      ${questions}
      <div class="list-actions">
        <button type="button" class="ghost" data-action="retry-written" ${writtenBusy >= 0 ? "disabled" : ""}>문제 다시 만들기</button>
      </div>
    </section>
  `;
}

function quizPassagePane(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    return `
      <section class="panel dashed quiz-passage-card">
        <p class="kicker">지문</p>
        <p class="lead">공부할 본문을 고르면 글 전체가 이 칸에 펼쳐집니다. 문제는 오른쪽에서 풀 수 있습니다.</p>
      </section>
    `;
  }
  const category = categoryById(current.categoryId);
  return `
    <section class="panel quiz-passage-card reader-panel">
      <div class="between">
        <p class="kicker">지문</p>
        <p class="tiny">${esc(category?.label || "")} · ${current.body.trim().length.toLocaleString("ko-KR")}자</p>
      </div>
      <h2 class="reader-title">${esc(current.title)}</h2>
      <div class="reader-body" lang="en">${esc(current.body)}</div>
    </section>
  `;
}

function renderQuiz(path, categoryId) {
  if (path === "/quiz/past") {
    go("/quiz");
    return;
  }
  const tab = QUIZ_TABS.find((item) => item.href === path) || QUIZ_TABS[0];
  const body = path === "/quiz"
    ? practiceSection(categoryId)
    : path === "/quiz/vocabulary"
      ? vocabularySection(categoryId)
      : path === "/quiz/grammar"
      ? grammarSection(categoryId)
      : path === "/quiz/order"
      ? orderSection(categoryId)
      : path === "/quiz/insert"
      ? insertSection(categoryId)
      : path === "/quiz/written"
      ? writtenSection(categoryId)
      : path === "/quiz/wordbook"
      ? wordbookSection(categoryId)
      : `
      <section class="panel">
        <h2>${esc(tab.label)}</h2>
        <p>여기는 ${esc(tab.label)} 화면입니다.</p>
        <p class="lead">${esc(tab.description)}</p>
      </section>
    `;
  const explainHtml = explainQuiz ? activeExplainHtml() : "";
  const showPassage = path === "/quiz/written";
  viewEl.innerHTML = `
    <div class="quiz-layout${explainHtml ? " is-split" : ""}">
      <div class="quiz-split-main">
        <div class="wrap page quiz-page">
          <div class="quiz-head">
            <h1>문제 풀이</h1>
            ${passagePicker(categoryId)}
            <nav class="subnav" aria-label="문제 풀이 메뉴">
              ${QUIZ_TABS.map((item) => `<a href="#${item.href}" ${item.href === tab.href ? 'aria-current="page"' : ""}>${esc(item.label)}</a>`).join("")}
            </nav>
          </div>
          <div class="study-split${showPassage ? " is-paired" : ""}">
            ${showPassage ? `<div class="study-pane study-passage" aria-label="지문">${quizPassagePane(categoryId)}</div>` : ""}
            <div class="study-pane study-tasks" aria-label="문제">${body}</div>
          </div>
        </div>
      </div>
      ${explainHtml}
    </div>
  `;
  document.title = `${tab.label} · 문제 풀이 · EngSel 엥셀`;
  if (path === "/quiz" && practicePassageId) loadPracticeAnswers(practicePassageId, practiceToken);
  if (path === "/quiz/wordbook" && wordbookPassageId) loadWordbook(wordbookPassageId, wordbookToken);
  if (path === "/quiz/vocabulary") startQuizDraft("vocabulary");
  if (path === "/quiz/grammar") startQuizDraft("grammar");
  if (path === "/quiz/written") startWritten();
}

function splitSentences(body) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const hidden = text.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Jr|Sr|St|vs|U\.S|U\.K|e\.g|i\.e)\./gi, (match) => `${match.slice(0, -1)}\u0000`);
  return hidden
    .split(/(?<=[.!?])\s+(?=[A-Z“"'])/)
    .map((sentence) => sentence.replaceAll("\u0000", ".").trim())
    .filter(Boolean);
}

function loadPracticeStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRACTICE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sentenceItems(passage) {
  const sentences = splitSentences(passage.body);
  const saved = loadPracticeStore()[passage.id];
  const previous = saved && saved.body === passage.body && Array.isArray(saved.items) ? saved.items : [];
  return sentences.map((en) => {
    const found = previous.find((item) => item && item.en === en);
    return {
      en,
      ko: typeof found?.ko === "string" ? found.ko : "",
      userTranslation: typeof found?.userTranslation === "string" ? found.userTranslation : "",
      showAnswer: Boolean(found?.showAnswer),
    };
  });
}

function savePracticeItems() {
  const passage = loadPassages().find((item) => item.id === practicePassageId);
  if (!passage) return;
  const store = loadPracticeStore();
  store[practicePassageId] = { body: passage.body, items: practiceItems };
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(store));
}

function practiceSection(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    practiceItems = [];
    practicePassageId = "";
    return `
      <section class="panel">
        <h2>해석</h2>
        <p class="lead">공부할 본문을 고르면 문장마다 해석을 적어 볼 수 있습니다.</p>
      </section>
    `;
  }
  practicePassageId = current.id;
  practiceItems = sentenceItems(current);
  practiceToken += 1;
  savePracticeItems();
  const waiting = practiceItems.some((item) => !item.ko);
  return `
    <section class="panel sentence-practice" data-practice="${esc(current.id)}">
      <h2>해석</h2>
      <p class="lead">영어 문장을 읽고 바로 아래에 한국어 해석을 적으세요. 정답은 필요할 때만 엽니다.</p>
      <p class="tiny" data-live="practice-status"${waiting ? "" : " hidden"}>올바른 해석을 준비하고 있습니다.</p>
      <ol class="sentence-list">
        ${practiceItems.map((item, index) => {
          const open = item.showAnswer && item.ko;
          return `
            <li>
              <p class="sentence-en" lang="en">${esc(item.en)}</p>
              <label class="field">한국어 해석
                <textarea class="plain-text" rows="2" data-field="user-translation" data-index="${index}" placeholder="이 문장의 해석을 적으세요.">${esc(item.userTranslation)}</textarea>
              </label>
              <button type="button" class="ghost" data-action="toggle-answer" data-index="${index}" aria-expanded="${open ? "true" : "false"}"${item.ko ? "" : " disabled"}>올바른 해석 ${open ? "숨기기" : "보기"}</button>
              <p class="sentence-answer" data-answer="${index}" lang="ko"${open ? "" : " hidden"}>${esc(item.ko)}</p>
            </li>
          `;
        }).join("")}
      </ol>
    </section>
  `;
}

async function loadPracticeAnswers(passageId, token) {
  const missing = practiceItems.flatMap((item, index) => (item.ko ? [] : [{ index, en: item.en }]));
  if (!missing.length || token !== practiceToken || practicePassageId !== passageId) return;
  const status = viewEl.querySelector("[data-live='practice-status']");
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentences: missing.map((item) => item.en) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (token !== practiceToken || practicePassageId !== passageId) return;
    if (!response.ok || !Array.isArray(payload.translations) || payload.translations.length !== missing.length) {
      throw new Error(payload.error || "fail");
    }
    missing.forEach((item, order) => {
      const ko = payload.translations[order];
      if (typeof ko === "string" && ko.trim()) practiceItems[item.index].ko = ko.trim();
    });
    savePracticeItems();
    practiceItems.forEach((item, index) => {
      const answer = viewEl.querySelector(`[data-answer="${index}"]`);
      const button = viewEl.querySelector(`[data-action="toggle-answer"][data-index="${index}"]`);
      if (answer && item.ko) answer.textContent = item.ko;
      if (button && item.ko) button.disabled = false;
    });
    if (status) status.hidden = true;
  } catch {
    if (token !== practiceToken || practicePassageId !== passageId) return;
    if (status) status.textContent = "올바른 해석을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.";
  }
}

function loadWordbookStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORDBOOK_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveWordbook() {
  const passage = loadPassages().find((item) => item.id === wordbookPassageId);
  if (!passage) return;
  const store = loadWordbookStore();
  store[wordbookPassageId] = {
    body: passage.body,
    hideMeanings: wordbookHideMeanings,
    filter: wordbookFilter,
    words: wordbookItems,
  };
  localStorage.setItem(WORDBOOK_KEY, JSON.stringify(store));
}

function wordKey(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function selectionPhrase(selection) {
  if (!selection) return "";
  const passage = loadPassages().find((item) => item.id === selection.root?.dataset?.annotate);
  return String(passage?.body?.slice(selection.from, selection.to) || "").replace(/\s+/g, " ").trim();
}

function selectionSentence(selection) {
  if (!selection) return "";
  const passage = loadPassages().find((item) => item.id === selection.root?.dataset?.annotate);
  const body = passage?.body || "";
  if (!body) return "";
  const [start, end] = sentenceBounds(body, selection.from);
  return body.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 500);
}

function sentenceAround(body, phrase) {
  const text = String(body || "");
  const at = text.toLowerCase().indexOf(String(phrase || "").toLowerCase());
  if (at < 0) return "";
  const [start, end] = sentenceBounds(text, at);
  return text.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 500);
}

function wordHasMeaning(item) {
  return Boolean(String(item?.meaning || "").trim());
}

function wordbookRecord(passage) {
  const store = loadWordbookStore();
  const saved = store[passage.id];
  if (saved && saved.body === passage.body && Array.isArray(saved.words)) return saved;
  return { body: passage.body, hideMeanings: true, filter: "all", words: [] };
}

function findWordbookEntry(words, phrase) {
  const key = wordKey(phrase);
  if (!key) return null;
  return words.find((item) => wordKey(item.word) === key) || null;
}

function syncWordbookToolbar() {
  const button = selectToolbar.querySelector("[data-action='add-wordbook']");
  if (!button) return;
  const onNotes = currentPath() === "/notes";
  button.hidden = !onNotes;
  if (!onNotes) return;
  const phrase = selectionPhrase(activeSelection);
  const passageId = activeSelection?.root?.dataset?.annotate || "";
  const saved = loadWordbookStore()[passageId];
  const entry = Array.isArray(saved?.words) ? findWordbookEntry(saved.words, phrase) : null;
  const added = Boolean(entry && (entry.saved || entry.addedAt));
  button.textContent = added ? "추가됨" : "단어장에 추가";
  button.classList.toggle("is-added", added);
  button.setAttribute("aria-pressed", added ? "true" : "false");
  button.disabled = !phrase;
}

function rememberWordbookItem(passageId, item) {
  if (wordbookPassageId !== passageId) return;
  const key = wordKey(item.word);
  const index = wordbookItems.findIndex((entry) => wordKey(entry.word) === key);
  if (index >= 0) wordbookItems[index] = { ...wordbookItems[index], ...item };
  else wordbookItems.unshift(item);
}

function lookupKey(passageId, phrase) {
  return `${passageId}\n${wordKey(phrase)}`;
}

function updateStoredWord(passageId, phrase, mutate) {
  const store = loadWordbookStore();
  const record = store[passageId];
  if (!record || !Array.isArray(record.words)) return null;
  const item = findWordbookEntry(record.words, phrase);
  if (!item) return null;
  mutate(item);
  if (!Array.isArray(item.synonyms)) item.synonyms = [];
  localStorage.setItem(WORDBOOK_KEY, JSON.stringify(store));
  if (wordbookPassageId === passageId) {
    const key = wordKey(phrase);
    const index = wordbookItems.findIndex((entry) => wordKey(entry.word) === key);
    const next = { ...item, synonyms: [...item.synonyms] };
    if (index >= 0) wordbookItems[index] = { ...wordbookItems[index], ...next };
    else wordbookItems.unshift(next);
    if (viewEl.querySelector("[data-live='wordbook-list']")) paintWordbook();
  }
  return item;
}

function requestWordLookup(passageId, phrase, context, notify = false) {
  const key = lookupKey(passageId, phrase);
  if (wordLookupInflight.has(key)) return;
  const store = loadWordbookStore();
  const existing = findWordbookEntry(store[passageId]?.words || [], phrase);
  if (!existing || wordHasMeaning(existing)) return;
  wordLookupInflight.add(key);
  const lookupId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  updateStoredWord(passageId, phrase, (item) => {
    item.lookup = "pending";
    item.lookupId = lookupId;
  });
  lookupWordEntry(phrase, context).then((info) => {
    wordLookupInflight.delete(key);
    updateStoredWord(passageId, phrase, (item) => {
      if (item.lookupId !== lookupId) return;
      item.partOfSpeech = info.partOfSpeech || item.partOfSpeech || "";
      item.meaning = info.meaning;
      item.synonyms = info.synonyms;
      item.lookup = "";
      item.lookupId = "";
      item.editing = false;
    });
    if (notify) showToast("뜻과 유의어를 단어장에 넣었습니다.");
  }).catch(() => {
    wordLookupInflight.delete(key);
    updateStoredWord(passageId, phrase, (item) => {
      if (item.lookupId !== lookupId) return;
      item.lookup = "failed";
      item.lookupId = "";
      item.editing = true;
      item.revealed = true;
    });
    if (notify) showToast("뜻을 찾지 못했습니다. 직접 입력해 주세요.");
  });
}

function fillMissingWordMeanings(passage) {
  if (!passage) return;
    wordbookItems.forEach((item) => {
    if (!item.addedAt || wordHasMeaning(item) || item.lookup === "failed") return;
    requestWordLookup(passage.id, item.word, sentenceAround(passage.body, item.word));
  });
}

function addSelectionToWordbook() {
  if (!activeSelection) return;
  const passageId = activeSelection.root?.dataset?.annotate || "";
  const passage = loadPassages().find((item) => item.id === passageId);
  const phrase = selectionPhrase(activeSelection);
  if (!passage || !phrase) return;
  if (phrase.length > 80) {
    showToast("단어나 짧은 표현을 선택한 뒤 추가해 주세요.");
    return;
  }
  const sentence = selectionSentence(activeSelection);
  const store = loadWordbookStore();
  const record = wordbookRecord(passage);
  const words = Array.isArray(record.words) ? record.words.map((item) => ({
    ...item,
    synonyms: Array.isArray(item.synonyms) ? [...item.synonyms] : [],
  })) : [];
  const existing = findWordbookEntry(words, phrase);
  if (existing && (existing.saved || existing.addedAt) && wordHasMeaning(existing)) {
    syncWordbookToolbar();
    showToast("이미 단어장에 있습니다.");
    return;
  }
  let savedItem = existing;
  if (existing) {
    existing.saved = true;
    existing.addedAt = existing.addedAt || new Date().toISOString();
    existing.sourceId = passage.id;
    existing.sourceTitle = passage.title;
  } else {
    savedItem = {
      word: phrase,
      partOfSpeech: "",
      meaning: "",
      synonyms: [],
      memorized: false,
      revealed: false,
      saved: true,
      addedAt: new Date().toISOString(),
      sourceId: passage.id,
      sourceTitle: passage.title,
      lookup: "",
      lookupId: "",
      editing: false,
    };
    words.unshift(savedItem);
  }
  record.words = words;
  record.body = passage.body;
  store[passageId] = record;
  localStorage.setItem(WORDBOOK_KEY, JSON.stringify(store));
  if (savedItem) rememberWordbookItem(passageId, savedItem);
  syncWordbookToolbar();
  if (wordbookPassageId === passageId && viewEl.querySelector("[data-live='wordbook-list']")) paintWordbook();
  if (wordHasMeaning(savedItem)) {
    showToast("단어장에 추가되었습니다.");
    return;
  }
  showToast("단어장에 추가되었습니다. 뜻을 찾고 있습니다.");
  requestWordLookup(passageId, phrase, sentence, true);
}

function synonymFieldValue(item) {
  if (Object.prototype.hasOwnProperty.call(item, "synonymDraft")) return item.synonymDraft;
  return (item.synonyms || []).join(", ");
}

function wordDetailHtml(item, index) {
  const covered = wordbookHideMeanings && !item.revealed;
  if (!wordHasMeaning(item) && item.lookup === "pending") {
    return `<p class="word-meaning is-pending">뜻을 찾고 있습니다.</p>`;
  }
  if (covered) {
    return `<button type="button" class="word-meaning is-covered" data-action="reveal-meaning" data-index="${index}" aria-expanded="false">뜻을 보려면 누르세요</button>`;
  }
  if (!wordHasMeaning(item) || item.editing) {
    return `
      <input class="word-meaning-input" data-field="word-meaning" data-index="${index}" value="${esc(item.meaning)}" placeholder="뜻을 입력해주세요" aria-label="뜻">
      <input class="word-synonyms-input" data-field="word-synonyms" data-index="${index}" value="${esc(synonymFieldValue(item))}" placeholder="동의어를 입력해주세요" aria-label="동의어">
    `;
  }
  return `
    <button type="button" class="word-meaning" data-action="reveal-meaning" data-index="${index}" aria-expanded="true">${esc(item.meaning)}</button>
    ${item.synonyms.length ? `<p class="word-synonyms">동의어 ${esc(item.synonyms.join(", "))}</p>` : ""}
    <button type="button" class="ghost" data-action="edit-word" data-index="${index}">뜻 수정</button>
  `;
}

function wordbookCards() {
  const visible = wordbookItems.filter((item) => wordbookFilter !== "saved" || item.saved);
  if (!wordbookItems.length) return "";
  if (!visible.length) return `<p class="lead">내 단어장에 담은 단어가 없습니다.</p>`;
  return `
    <ul class="word-list">
      ${visible.map((item) => {
        const index = wordbookItems.indexOf(item);
        return `
          <li class="word-card${item.memorized ? " is-memorized" : ""}">
            <div class="word-card-head">
              <div>
                <p class="word-card-word" lang="en">${esc(item.word)}</p>
                ${item.partOfSpeech ? `<p class="word-card-pos">${esc(item.partOfSpeech)}</p>` : ""}
              </div>
              <label class="word-check" data-action="toggle-memorized" data-index="${index}">
                <input type="checkbox"${item.memorized ? " checked" : ""}>
                외움
              </label>
            </div>
            ${wordDetailHtml(item, index)}
            ${item.addedAt ? `<p class="word-source">학습 노트 · ${esc(item.sourceTitle || "본문")}</p>` : ""}
            <button type="button" class="ghost" data-action="save-word" data-index="${index}">${item.saved ? "내 단어장에서 빼기" : "내 단어장에 추가"}</button>
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function wordbookSection(categoryId) {
  const passage = activePassage();
  const current = passage && passage.categoryId === categoryId ? passage : null;
  if (!current || !current.body.trim()) {
    wordbookItems = [];
    wordbookPassageId = "";
    return `
      <section class="panel">
        <h2>단어장</h2>
        <p class="lead">공부할 본문을 고르면 그 글의 핵심 단어가 여기에 모입니다.</p>
      </section>
    `;
  }
  const saved = loadWordbookStore()[current.id];
  const cached = saved && saved.body === current.body && Array.isArray(saved.words) ? saved.words : [];
  wordbookPassageId = current.id;
  wordbookItems = cached.map((item) => ({
    word: String(item.word || ""),
    partOfSpeech: String(item.partOfSpeech || ""),
    meaning: String(item.meaning || ""),
    synonyms: Array.isArray(item.synonyms) ? item.synonyms.filter((entry) => typeof entry === "string") : [],
    memorized: Boolean(item.memorized),
    revealed: Boolean(item.revealed),
    saved: Boolean(item.saved),
    addedAt: typeof item.addedAt === "string" ? item.addedAt : "",
    sourceId: typeof item.sourceId === "string" ? item.sourceId : "",
    sourceTitle: typeof item.sourceTitle === "string" ? item.sourceTitle : "",
    lookup: item.lookup === "pending" || item.lookup === "failed" ? item.lookup : "",
    lookupId: typeof item.lookupId === "string" ? item.lookupId : "",
    editing: Boolean(item.editing),
  })).filter((item) => item.word);
  wordbookHideMeanings = typeof saved?.hideMeanings === "boolean" ? saved.hideMeanings : true;
  wordbookFilter = saved?.filter === "saved" ? "saved" : "all";
  wordbookToken += 1;
  const loading = wordbookItems.length === 0;
  return `
    <section class="panel wordbook" data-wordbook="${esc(current.id)}">
      <div class="between">
        <h2>단어장</h2>
        <p class="tiny">${wordbookItems.filter((item) => item.memorized).length}/${wordbookItems.length || "–"} 외움</p>
      </div>
      <p class="lead">본문에서 고른 핵심 단어입니다. 뜻은 가려 두고 스스로 떠올린 뒤 확인할 수 있습니다.</p>
      <div class="wordbook-tools">
        <button type="button" class="ghost${wordbookHideMeanings ? " is-on" : ""}" data-action="toggle-hide-meanings" aria-pressed="${wordbookHideMeanings}">뜻 가리기</button>
        <button type="button" class="ghost${wordbookFilter === "saved" ? " is-on" : ""}" data-action="wordbook-filter" aria-pressed="${wordbookFilter === "saved"}">내 단어장</button>
      </div>
      <div class="wordbook-status" data-live="wordbook-status"${loading ? "" : " hidden"}>
        <span class="spinner" aria-hidden="true"></span>
        <span data-live="wordbook-message">핵심 단어를 고르고 있습니다.</span>
      </div>
      <div data-live="wordbook-list">${wordbookCards()}</div>
    </section>
  `;
}

function paintWordbook(keepFocus = true) {
  const active = keepFocus ? document.activeElement : null;
  const field = active?.dataset?.field;
  const index = active?.dataset?.index;
  const caret = active?.selectionStart;
  const list = viewEl.querySelector("[data-live='wordbook-list']");
  const count = viewEl.querySelector(".wordbook .tiny");
  if (list) list.innerHTML = wordbookCards();
  if (count) count.textContent = `${wordbookItems.filter((item) => item.memorized).length}/${wordbookItems.length} 외움`;
  const savedButton = viewEl.querySelector("[data-action='wordbook-filter']");
  if (savedButton) {
    const savedOn = wordbookFilter === "saved";
    savedButton.classList.toggle("is-on", savedOn);
    savedButton.setAttribute("aria-pressed", savedOn ? "true" : "false");
  }
  const hideButton = viewEl.querySelector("[data-action='toggle-hide-meanings']");
  if (hideButton) {
    hideButton.classList.toggle("is-on", wordbookHideMeanings);
    hideButton.setAttribute("aria-pressed", wordbookHideMeanings ? "true" : "false");
  }
  if (field === "word-meaning" || field === "word-synonyms") {
    const next = viewEl.querySelector(`[data-field='${field}'][data-index='${index}']`);
    if (next) {
      next.focus();
      if (Number.isInteger(caret)) next.setSelectionRange(caret, caret);
    }
  }
  saveWordbook();
}

async function loadWordbook(passageId, token, force = false) {
  const passage = loadPassages().find((item) => item.id === passageId);
  if (!force && wordbookItems.length) {
    fillMissingWordMeanings(passage);
    return;
  }
  const status = viewEl.querySelector("[data-live='wordbook-status']");
  const message = viewEl.querySelector("[data-live='wordbook-message']");
  if (!passage || token !== wordbookToken || wordbookPassageId !== passageId) return;
  if (status) status.hidden = false;
  if (message) message.textContent = "핵심 단어를 고르고 있습니다.";
  try {
    const words = await extractKeyVocabulary(passage.body);
    if (token !== wordbookToken || wordbookPassageId !== passageId) return;
    const previous = wordbookItems;
    const generated = words.map((item) => {
      const old = previous.find((entry) => entry.word.toLowerCase() === item.word.toLowerCase());
      return {
        word: item.word,
        partOfSpeech: item.partOfSpeech,
        meaning: item.meaning,
        synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
        memorized: Boolean(old?.memorized),
        revealed: Boolean(old?.revealed),
        saved: Boolean(old?.saved),
        addedAt: old?.addedAt || "",
        sourceId: old?.sourceId || "",
        sourceTitle: old?.sourceTitle || "",
        lookup: "",
        lookupId: "",
        editing: false,
      };
    });
    const generatedKeys = new Set(generated.map((item) => item.word.toLowerCase()));
    const picked = previous.filter((item) => item.addedAt && !generatedKeys.has(item.word.toLowerCase()));
    wordbookItems = [...picked, ...generated];
    if (status) status.hidden = true;
    paintWordbook();
    fillMissingWordMeanings(passage);
  } catch (error) {
    if (token !== wordbookToken || wordbookPassageId !== passageId) return;
    if (message) message.textContent = error instanceof Error ? error.message : "단어를 불러오지 못했습니다.";
    const list = viewEl.querySelector("[data-live='wordbook-list']");
    if (list && !wordbookItems.length) {
      list.innerHTML = `<button type="button" class="ghost" data-action="retry-vocabulary">다시 시도</button>`;
    }
  }
}

function renderFeature(path, categoryId) {
  const feature = FEATURES.find((item) => item.href === path);
  if (!feature) {
    go("/");
    return;
  }
  const hidePassage = path === "/assistant" || path === "/plan";
  viewEl.innerHTML = `
    <article class="wrap page stack" style="max-width:48rem">
      ${hidePassage ? "" : passagePicker(categoryId)}
      ${hidePassage ? "" : passageBanner()}
      <h1>${esc(feature.title)}</h1>
    </article>
  `;
  document.title = `${feature.title} · EngSel 엥셀`;
}

function tickStudy() {
  const path = currentPath();
  const id = path.split("/")[2];
  if (!path.startsWith("/study/") || !isCategory(id)) return;
  const study = loadStudies().find((item) => item.categoryId === id);
  const dday = viewEl.querySelector("[data-live='dday']");
  const countdown = viewEl.querySelector("[data-live='countdown']");
  if (!study || !dday || !countdown) return;
  const now = new Date();
  dday.textContent = study.examDate ? getDDay(study.examDate, now) || "시험일 미정" : "시험일 미정";
  countdown.textContent = study.examDate ? formatCountdown(study.examDate, now) : "시험일을 정하면 남은 시간이 표시됩니다.";
}

function render() {
  const path = currentPath();
  const entered = path !== lastPath;
  lastPath = path;
  const studyId = path.startsWith("/study/") ? path.split("/")[2] : "";

  if (path === "/" && !embedded) setActiveCategory("");
  if (isCategory(studyId)) setActiveCategory(studyId);

  const categoryId = path === "/" ? "" : isCategory(studyId) ? studyId : activeCategory();
  if (isLearning(path) && !categoryId) {
    showNotice();
    if (location.hash !== "#/") location.hash = "#/";
    return;
  }
  if (path.startsWith("/study/") && !isCategory(studyId)) {
    go("/");
    return;
  }
  if (path !== "/passage") {
    draft.imageOpen = false;
    savedImageReview = null;
  }
  const explainPaths = {
    vocabulary: "/quiz/vocabulary",
    grammar: "/quiz/grammar",
    order: "/quiz/order",
    insert: "/quiz/insert",
  };
  if (explainQuiz && explainPaths[explainQuiz] !== path) explainQuiz = "";

  renderHeader(path, categoryId);
  if (path === "/") renderHome();
  else if (path.startsWith("/study/")) renderStudy(studyId);
  else if (path === "/passage") {
    if (entered && !draft.editingId && categoryId) draft.categoryId = categoryId;
    renderPassage(categoryId);
  }   else if (path === "/notes") renderNotes(categoryId);
  else if (path === "/rewrite") renderRewrite(categoryId);
  else if (path === "/quiz" || path.startsWith("/quiz/")) renderQuiz(path, categoryId);
  else renderFeature(path, categoryId);

  const hideAssistant = path === "/" || path.startsWith("/study/");
  const reviewingImage = path === "/passage" && (Boolean(savedImageReview) || (draft.mode === "image" && draft.imageOpen && Boolean(draft.previewUrl)));
  document.body.classList.toggle("is-reviewing-image", reviewingImage);
  document.body.classList.toggle("is-explain-open", Boolean(explainQuiz));
  document.body.classList.toggle("is-quiz", path === "/quiz" || path.startsWith("/quiz/"));
  headerEl.inert = reviewingImage;
  assistantEl.inert = reviewingImage;
  assistantEl.hidden = hideAssistant;
  if (hideAssistant) setAssistantOpen(false);
  window.clearInterval(clockTimer);
  if (path.startsWith("/study/")) clockTimer = window.setInterval(tickStudy, 1000);
  rebindMemoDraft();
  placeInlineNotes();
  syncUndoButtons();
}

function updateStudy(categoryId, patch) {
  const studies = loadStudies().map((item) => (item.categoryId === categoryId ? { ...item, ...patch } : item));
  saveStudies(studies);
}

async function savePassage() {
  const body = draftBody().trim();
  const title = draft.title.trim();
  if (!body || draft.ocrState === "loading") return;
  if (!title) {
    draft.imageOpen = false;
    draft.message = "제목을 입력해야 본문을 저장할 수 있습니다.";
    draft.messageTone = "error";
    render();
    viewEl.querySelector("#passage-title")?.focus();
    return;
  }
  const passages = loadPassages();
  const editing = passages.find((item) => item.id === draft.editingId);
  const currentCategory = activeCategory();
  const categoryId = editing
    ? (isCategory(editing.categoryId) ? editing.categoryId : (isCategory(currentCategory) ? currentCategory : "textbook"))
    : (isCategory(currentCategory) ? currentCategory : (isCategory(draft.categoryId) ? draft.categoryId : "textbook"));
  draft.categoryId = categoryId;
  const passage = editing
    ? { ...editing, title, body, categoryId }
    : {
        id: crypto.randomUUID(),
        title,
        body,
        createdAt: new Date().toISOString(),
        categoryId,
        imageName: "",
      };
  if (draft.mode === "image" && draft.file) {
    try {
      await putPassageImage(passage.id, draft.file, draft.imageName || "이미지");
      passage.imageName = draft.imageName || "이미지";
      rememberPassageImage(passage.id, draft.file);
    } catch {
      draft.imageOpen = false;
      draft.message = "이미지를 본문과 함께 저장하지 못했습니다.";
      draft.messageTone = "error";
      render();
      return;
    }
  }
  const next = editing ? passages.map((item) => (item.id === passage.id ? passage : item)) : [passage, ...passages];
  savePassages(next);
  setActivePassage(passage.id);
  const savedEdit = Boolean(editing);
  clearDraft();
  draft.message = savedEdit
    ? "본문을 수정했습니다. 다음 본문을 입력할 수 있습니다."
    : "본문을 저장했습니다. 다음 본문을 입력할 수 있습니다.";
  draft.messageTone = "success";
  render();
}

async function openSavedImage(id) {
  const passage = loadPassages().find((item) => item.id === id);
  if (!passage?.imageName) return false;
  let imageUrl = passageImageUrls.get(id) || "";
  if (!imageUrl) {
    try {
      const record = await getPassageImage(id);
      if (!record?.blob) return false;
      imageUrl = URL.createObjectURL(record.blob);
      passageImageUrls.set(id, imageUrl);
    } catch {
      return false;
    }
  }
  draft.imageOpen = false;
  imageEditHintId = "";
  savedImageReview = {
    id: passage.id,
    title: passage.title,
    body: passage.body,
    imageUrl,
    imageName: passage.imageName,
    notice: "",
  };
  render();
  viewEl.querySelector("#saved-review-body")?.focus();
  return true;
}

function beginTextEdit(passage) {
  imageEditHintId = "";
  clearDraft();
  draft.mode = "text";
  draft.categoryId = passage.categoryId;
  draft.title = passage.title;
  draft.textBody = passage.body;
  draft.editingId = passage.id;
  render();
  viewEl.querySelector(".passage-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveSavedReview() {
  if (!savedImageReview) return;
  const title = savedImageReview.title.trim();
  const body = savedImageReview.body.trim();
  if (!title || !body) {
    savedImageReview.notice = title ? "" : "제목을 입력해야 본문을 저장할 수 있습니다.";
    render();
    viewEl.querySelector(title ? "#saved-review-body" : "#saved-review-title")?.focus();
    return;
  }
  const passages = loadPassages();
  if (!passages.some((item) => item.id === savedImageReview.id)) return;
  savePassages(passages.map((item) => (
    item.id === savedImageReview.id ? { ...item, title, body } : item
  )));
  savedImageReview = null;
  draft.message = "본문을 수정했습니다.";
  draft.messageTone = "success";
  render();
}

function imageFileFromClipboard(data) {
  if (!data) return null;
  const pasted = [...(data.files || [])].find((file) => file.type.startsWith("image/"));
  if (pasted) return pasted;
  for (const item of data.items || []) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

function assignPastedImage(file) {
  const named = namedPasteFile(file);
  const input = document.getElementById("passage-file");
  if (!(input instanceof HTMLInputElement)) {
    acceptImage(named);
    return;
  }
  const transfer = new DataTransfer();
  transfer.items.add(named);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function namedPasteFile(file) {
  let type = (file.type || "image/png").toLowerCase();
  if (type === "image/jpg") type = "image/jpeg";
  const generic = !file.name || file.name === "image.png" || file.name.startsWith("blob");
  if (!generic && type === file.type) return file;
  const ext = type === "image/jpeg" ? "jpg" : (type.split("/")[1] || "png");
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const name = generic
    ? `붙여넣은 이미지 ${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${ext}`
    : file.name;
  return new File([file], name, { type });
}

function acceptImage(file) {
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    draft.message = "PNG, JPG, WEBP, GIF 파일만 올릴 수 있습니다.";
    draft.messageTone = "error";
    render();
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    draft.message = "이미지는 8MB 이하로 올려 주세요.";
    draft.messageTone = "error";
    render();
    return;
  }
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  draft.previewUrl = URL.createObjectURL(file);
  draft.imageName = file.name;
  draft.file = file;
  draft.mode = "image";
  readImage(file);
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("이미지 글자 읽기 도구를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return window.Tesseract;
}

function normalizeOcrText(raw) {
  const lines = String(raw).replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n").split("\n");
  const paragraphs = [];
  let parts = [];

  function flush() {
    if (!parts.length) return;
    paragraphs.push(parts.join(" ").replace(/ {2,}/g, " ").trim());
    parts = [];
  }

  for (const line of lines) {
    const trimmed = line.replace(/[ \t]+/g, " ").trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const previous = parts[parts.length - 1];
    if (previous && previous.endsWith("-") && /^[a-z(]/.test(trimmed)) {
      parts[parts.length - 1] = `${previous.slice(0, -1)}${trimmed}`;
    } else {
      parts.push(trimmed);
    }
  }
  flush();
  return paragraphs.join("\n\n");
}

async function readImage(file) {
  const token = ++ocrToken;
  draft.ocrState = "loading";
  draft.imageBody = "";
  draft.message = "이미지에서 영어 글자를 읽고 있습니다.";
  draft.messageTone = "info";
  if (currentPath() === "/passage") render();
  try {
    const Tesseract = await loadTesseract();
    const result = await Tesseract.recognize(file, "eng");
    if (token !== ocrToken) return;
    const text = normalizeOcrText(result?.data?.text || "");
    draft.imageBody = text;
    draft.ocrState = text ? "done" : "empty";
    draft.message = text
      ? "글자를 읽었습니다. 틀린 부분을 고친 뒤 저장해 주세요."
      : "글자를 찾지 못했습니다. 직접 입력하거나 다른 이미지를 올려 주세요.";
    draft.messageTone = text ? "success" : "error";
  } catch (error) {
    if (token !== ocrToken) return;
    draft.ocrState = "error";
    draft.message = error instanceof Error ? error.message : "이미지를 읽지 못했습니다.";
    draft.messageTone = "error";
  }
  if (currentPath() === "/passage") render();
}

function setAssistantOpen(open) {
  assistantState.open = open;
  assistantPanel.hidden = !open;
  assistantToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function paintAssistant() {
  if (!assistantState.messages.length) {
    assistantLog.innerHTML = `<p class="muted">공부하다가 궁금한 점을 물어보세요.</p>`;
    return;
  }
  assistantLog.innerHTML = assistantState.messages
    .map((message) => `<p class="bubble ${message.role === "user" ? "user" : "reply"}">${esc(message.content)}</p>`)
    .join("") + (assistantState.pending ? `<p class="bubble reply">답을 준비하고 있습니다.</p>` : "");
  assistantLog.scrollTop = assistantLog.scrollHeight;
}

async function askAssistant(event) {
  event.preventDefault();
  const content = assistantQuestion.value.trim();
  if (!content || assistantState.pending) return;
  assistantState.messages.push({ role: "user", content });
  assistantState.pending = true;
  assistantQuestion.value = "";
  assistantSend.disabled = true;
  paintAssistant();
  const passage = activePassage();
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: assistantState.messages.map((message) => ({ role: message.role, content: message.content })),
        passage: passage ? { title: passage.title, body: passage.body } : null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    const answer = typeof data.text === "string" ? data.text.trim() : "";
    assistantState.messages.push({
      role: "assistant",
      content: answer || (typeof data.error === "string" ? data.error : "도우미가 답을 하지 못했습니다."),
    });
  } catch {
    assistantState.messages.push({
      role: "assistant",
      content: "도우미에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
  assistantState.pending = false;
  assistantSend.disabled = assistantQuestion.value.trim().length === 0;
  paintAssistant();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "locked-nav") {
    showNotice();
    return;
  }
  if (action === "add-highlight") {
    openPenPicker();
    return;
  }
  if (action === "pick-pen") {
    const color = memoColor(target.dataset.color);
    if (!PEN_COLORS.includes(color)) return;
    if (penEdit) recolorMark(penEdit.root, penEdit.id, color);
    else highlightSelection("", color, "fill");
    return;
  }
  if (action === "clear-pen") {
    if (!penEdit) return;
    removePenMark(penEdit.root, penEdit.id);
    return;
  }
  if (action === "add-memo") {
    openMemoEditor();
    return;
  }
  if (action === "add-wordbook") {
    addSelectionToWordbook();
    return;
  }
  if (action === "close-memo") {
    hideMemo();
    return;
  }
  if (action === "edit-memo") {
    editTargetMemo();
    return;
  }
  if (action === "delete-memo") {
    deleteTargetMemo();
    return;
  }
  if (action === "go-back") {
    undoAnnotation();
    return;
  }
  if (action === "toggle-eraser") {
    setEraser(!eraserOn);
    hideToolbar();
    hideNote();
    hideNoteActions();
    return;
  }
  if (action === "eraser-mode") {
    setEraserMode(target.dataset.mode);
    hideToolbar();
    hideNote();
    hideNoteActions();
    return;
  }
  if (action === "flow-feedback") {
    requestFlowFeedback(Number(target.dataset.index));
    return;
  }
  if (action === "memo-display") {
    setMemoDisplay(target.dataset.mode);
    hideToolbar();
    hideMemo();
    return;
  }
  if (action === "toggle-answer") {
    const index = Number(target.dataset.index);
    const item = practiceItems[index];
    if (!item?.ko) return;
    item.showAnswer = !item.showAnswer;
    const answer = viewEl.querySelector(`[data-answer="${index}"]`);
    if (answer) answer.hidden = !item.showAnswer;
    target.textContent = `올바른 해석 ${item.showAnswer ? "숨기기" : "보기"}`;
    target.setAttribute("aria-expanded", item.showAnswer ? "true" : "false");
    savePracticeItems();
    return;
  }
  if (action === "toggle-memorized") {
    const index = Number(target.dataset.index);
    if (!wordbookItems[index]) return;
    const box = target.querySelector("input");
    wordbookItems[index].memorized = Boolean(box?.checked);
    paintWordbook();
    return;
  }
  if (action === "reveal-meaning") {
    if (!wordbookHideMeanings) return;
    const index = Number(target.dataset.index);
    if (!wordbookItems[index]) return;
    wordbookItems[index].revealed = !wordbookItems[index].revealed;
    paintWordbook();
    return;
  }
  if (action === "edit-word") {
    const index = Number(target.dataset.index);
    if (!wordbookItems[index]) return;
    wordbookItems[index].editing = true;
    paintWordbook();
    viewEl.querySelector(`[data-field='word-meaning'][data-index='${index}']`)?.focus();
    return;
  }
  if (action === "toggle-hide-meanings") {
    wordbookHideMeanings = !wordbookHideMeanings;
    if (wordbookHideMeanings) wordbookItems.forEach((item) => { item.revealed = false; });
    paintWordbook();
    return;
  }
  if (action === "save-word") {
    const index = Number(target.dataset.index);
    if (!wordbookItems[index]) return;
    wordbookItems[index].saved = !wordbookItems[index].saved;
    paintWordbook();
    return;
  }
  if (action === "submit-written") {
    const index = Number(target.dataset.index);
    const field = viewEl.querySelector(`[data-field='written-answer'][data-index='${index}']`);
    const answer = (field?.value || writtenAnswers[index] || "").trim();
    if (!writtenItems[index] || !answer) return;
    writtenAnswers[index] = answer;
    submitWritten(index);
    return;
  }
  if (action === "retry-written") {
    if (writtenBusy >= 0 || !writtenBody) return;
    writtenItems = [];
    writtenAnswers = [];
    writtenFeedback = [];
    writtenSource = "";
    writtenState = "loading";
    writtenMessage = "";
    writtenBusy = -1;
    writtenToken += 1;
    writtenPending = true;
    render();
    return;
  }
  if (action === "pick-vocab") {
    if (vocabGraded) return;
    const index = Number(target.dataset.vocab);
    const option = Number(target.dataset.option);
    if (!vocabItems[index] || !vocabItems[index].options[option]) return;
    vocabPicks[index] = option;
    render();
    return;
  }
  if (action === "grade-vocab") {
    if (!vocabItems.length || vocabGraded) return;
    vocabGraded = true;
    render();
    return;
  }
  if (action === "reset-vocab") {
    vocabPicks = {};
    vocabGraded = false;
    render();
    return;
  }
  if (action === "pick-grammar") {
    if (grammarGraded) return;
    const index = Number(target.dataset.grammar);
    const option = Number(target.dataset.option);
    if (!grammarItems[index] || !grammarItems[index].options[option]) return;
    grammarPicks[index] = option;
    render();
    return;
  }
  if (action === "grade-grammar") {
    if (!grammarItems.length || grammarGraded) return;
    grammarGraded = true;
    render();
    return;
  }
  if (action === "reset-grammar") {
    grammarPicks = {};
    grammarGraded = false;
    render();
    return;
  }
  if (action === "grade-order") {
    if (!orderItems.length || orderGraded) return;
    readOrderAnswers();
    orderGraded = true;
    render();
    return;
  }
  if (action === "reset-order") {
    orderItems.forEach((_, index) => {
      orderPicks[index] = "";
    });
    orderGraded = false;
    render();
    return;
  }
  if (action === "pick-insert") {
    if (insertGraded) return;
    const question = Number(target.dataset.question);
    const option = Number(target.dataset.option);
    if (!insertItems[question] || option < 0 || option > insertItems[question].rest.length) return;
    insertPicks[question] = option;
    render();
    return;
  }
  if (action === "grade-insert") {
    if (!insertItems.length || insertGraded) return;
    insertGraded = true;
    render();
    return;
  }
  if (action === "reset-insert") {
    insertPicks = {};
    insertGraded = false;
    render();
    return;
  }
  if (action === "show-explain") {
    const quiz = target.dataset.quiz;
    if (!["vocabulary", "grammar", "order", "insert"].includes(quiz)) return;
    if (quiz === "order") readOrderAnswers();
    const opening = explainQuiz !== quiz;
    const kept = quizPaneScroll();
    explainQuiz = opening ? quiz : "";
    render();
    restoreQuizScroll(opening ? kept : 0);
    return;
  }
  if (action === "close-explain") {
    const kept = quizPaneScroll();
    explainQuiz = "";
    render();
    restoreQuizScroll(kept);
    return;
  }
  if (action === "retry-vocabulary") {
    loadWordbook(wordbookPassageId, wordbookToken, true);
    return;
  }
  if (action === "retry-vocab-quiz" || action === "retry-grammar-quiz") {
    const grammar = action === "retry-grammar-quiz";
    if (grammar) {
      grammarItems = [];
      grammarPicks = {};
      grammarGraded = false;
      grammarQuizState = "loading";
      grammarQuizMessage = "";
      grammarQuizToken += 1;
      grammarDraftPending = true;
    } else {
      vocabItems = [];
      vocabPicks = {};
      vocabGraded = false;
      vocabQuizState = "loading";
      vocabQuizMessage = "";
      vocabQuizToken += 1;
      vocabDraftPending = true;
    }
    render();
    return;
  }
  if (action === "wordbook-filter") {
    wordbookFilter = wordbookFilter === "saved" ? "all" : "saved";
    paintWordbook();
    return;
  }
  if (action === "passage-mode") {
    draft.mode = target.dataset.mode === "image" ? "image" : "text";
    if (draft.mode !== "image") draft.imageOpen = false;
    render();
    return;
  }
  if (action === "open-image" && draft.previewUrl) {
    savedImageReview = null;
    draft.imageOpen = true;
    render();
    viewEl.querySelector("#image-review-body")?.focus();
    return;
  }
  if (action === "open-saved-image") {
    openSavedImage(id);
    return;
  }
  if (action === "close-image") {
    savedImageReview = null;
    draft.imageOpen = false;
    render();
    return;
  }
  if (action === "save-saved-review") {
    saveSavedReview();
    return;
  }
  if (action === "save-passage") savePassage();
  if (action === "select-passage" || action === "pick-passage") {
    setActivePassage(id);
    render();
  }
  if (action === "edit-passage") {
    const passage = loadPassages().find((item) => item.id === id);
    if (!passage) return;
    if (passage.imageName) {
      imageEditHintId = "";
      void openSavedImage(id).then((opened) => {
        if (opened) return;
        beginTextEdit(passage);
      });
      return;
    }
    beginTextEdit(passage);
  }
  if (action === "delete-passage") {
    forgetPassageImage(id);
    if (savedImageReview?.id === id) savedImageReview = null;
    if (imageEditHintId === id) imageEditHintId = "";
    savePassages(loadPassages().filter((item) => item.id !== id));
    if (activePassageId() === id) setActivePassage("");
    if (draft.editingId === id) clearDraft();
    removeStudyNote(id);
    removeFlowRecord(id);
    render();
  }
  if (action === "clear-image") {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    draft.previewUrl = "";
    draft.imageName = "";
    draft.imageOpen = false;
    draft.file = null;
    draft.imageBody = "";
    draft.ocrState = "idle";
    draft.message = "";
    ocrToken += 1;
    render();
  }
  if (action === "reread-image" && draft.file) readImage(draft.file);
  if (action === "close-assistant") setAssistantOpen(false);
});

document.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (field === "word-meaning" || field === "word-synonyms") {
    const index = Number(event.target.dataset.index);
    const item = wordbookItems[index];
    if (!item) return;
    item.lookupId = "";
    item.lookup = "";
    item.editing = true;
    if (field === "word-meaning") item.meaning = event.target.value;
    else {
      item.synonymDraft = event.target.value;
      item.synonyms = event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
    saveWordbook();
    return;
  }
  if (field === "flow-note") {
    const index = Number(event.target.dataset.index);
    if (!flowView[index] || !flowPassageId) return;
    flowView[index].note = event.target.value;
    saveFlowRecord(flowPassageId);
    const card = event.target.closest(".flow-card");
    const status = card?.querySelector("[data-live='flow-save']");
    if (status) status.textContent = "저장됨";
    const panel = card?.querySelector("[data-live='flow-feedback']");
    if (panel?.dataset.forNote) panel.hidden = panel.dataset.forNote !== event.target.value;
    return;
  }
  if (field === "written-answer") {
    const index = Number(event.target.dataset.index);
    if (!writtenItems[index]) return;
    writtenAnswers[index] = event.target.value;
    return;
  }
  if (field === "user-translation") {
    const index = Number(event.target.dataset.index);
    if (!practiceItems[index]) return;
    practiceItems[index].userTranslation = event.target.value;
    savePracticeItems();
    return;
  }
  if (field === "study-note") {
    const passageId = event.target.dataset.passageId;
    if (passageId) {
      saveStudyNote(passageId, event.target.value);
      const status = viewEl.querySelector("[data-live='note-status']");
      if (status) status.textContent = "저장됨";
    }
  }
  if (field === "note") {
    const id = currentPath().split("/")[2];
    if (isCategory(id)) updateStudy(id, { note: event.target.value });
  }
  if (field === "passage-title") {
    draft.title = event.target.value;
    viewEl.querySelectorAll("[data-field='passage-title']").forEach((input) => {
      if (input !== event.target) input.value = event.target.value;
    });
  }
  if (field === "passage-body") {
    draft.textBody = event.target.value;
    const count = viewEl.querySelector("[data-live='char-count']");
    const button = viewEl.querySelector("[data-action='save-passage']");
    if (count) count.textContent = `${event.target.value.trim().length.toLocaleString("ko-KR")}자`;
    if (button) button.disabled = event.target.value.trim().length === 0;
  }
  if (field === "saved-review-title" && savedImageReview) {
    savedImageReview.title = event.target.value;
    savedImageReview.notice = "";
    const review = event.target.closest(".image-review");
    const button = review?.querySelector("[data-action='save-saved-review']");
    if (button) button.disabled = event.target.value.trim().length === 0 || savedImageReview.body.trim().length === 0;
  }
  if (field === "saved-review-body" && savedImageReview) {
    savedImageReview.body = event.target.value;
    savedImageReview.notice = "";
    const review = event.target.closest(".image-review");
    const count = review?.querySelector("[data-live='saved-char-count']");
    const button = review?.querySelector("[data-action='save-saved-review']");
    if (count) count.textContent = `${event.target.value.trim().length.toLocaleString("ko-KR")}자`;
    if (button) button.disabled = event.target.value.trim().length === 0 || savedImageReview.title.trim().length === 0;
  }
  if (field === "image-body") {
    draft.imageBody = event.target.value;
    const countText = `${event.target.value.trim().length.toLocaleString("ko-KR")}자`;
    const blocked = event.target.value.trim().length === 0 || draft.ocrState === "loading";
    viewEl.querySelectorAll("[data-live='char-count']").forEach((count) => {
      count.textContent = countText;
    });
    viewEl.querySelectorAll("[data-action='save-passage']").forEach((button) => {
      button.disabled = blocked;
    });
  }
});

document.addEventListener("focusout", (event) => {
  const field = event.target?.dataset?.field;
  if (field === "word-meaning" || field === "word-synonyms") {
    const index = event.target.dataset.index;
    const nextField = event.relatedTarget?.dataset?.field;
    if (event.relatedTarget?.dataset?.index === index && (nextField === "word-meaning" || nextField === "word-synonyms")) return;
    const item = wordbookItems[Number(index)];
    if (!item) return;
    const wasEditing = item.editing || !wordHasMeaning(item);
    item.meaning = String(item.meaning || "").replace(/\s+/g, " ").trim();
    delete item.synonymDraft;
    item.editing = !wordHasMeaning(item);
    saveWordbook();
    if (wasEditing && wordHasMeaning(item) && viewEl.querySelector("[data-live='wordbook-list']")) paintWordbook(false);
    return;
  }
  if (field !== "flow-note") return;
  if (event.relatedTarget?.dataset?.field === "flow-note") return;
  applyPendingFlow();
});

document.addEventListener("change", (event) => {
  const field = event.target.dataset.field;
  if (field === "exam-date") {
    const id = currentPath().split("/")[2];
    if (!isCategory(id)) return;
    updateStudy(id, { examDate: event.target.value || null });
    tickStudy();
  }
  if (event.target.id === "passage-file" && event.target.files?.[0]) {
    acceptImage(event.target.files[0]);
    event.target.value = "";
  }
});

document.addEventListener("dragover", (event) => {
  if (!event.target.closest("[data-dropzone]")) return;
  event.preventDefault();
  event.target.closest("[data-dropzone]").classList.add("is-dragging");
});

document.addEventListener("dragleave", (event) => {
  const zone = event.target.closest?.("[data-dropzone]");
  if (!zone) return;
  zone.classList.remove("is-dragging");
});

document.addEventListener("drop", (event) => {
  const zone = event.target.closest?.("[data-dropzone]");
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove("is-dragging");
  const file = event.dataTransfer?.files?.[0];
  if (file) acceptImage(file);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!memoPopover.hidden) {
    hideMemo();
    return;
  }
  if (explainQuiz) {
    explainQuiz = "";
    render();
    return;
  }
  if (savedImageReview || draft.imageOpen) {
    savedImageReview = null;
    draft.imageOpen = false;
    render();
    return;
  }
  if (eraserOn) setEraser(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "v" || !(event.ctrlKey || event.metaKey)) return;
  if (!(event.target instanceof HTMLInputElement) || event.target.type !== "file") return;
  event.target.blur();
}, true);

window.addEventListener("paste", (event) => {
  if (currentPath() !== "/passage") return;
  const clipboard = event.clipboardData;
  const file = imageFileFromClipboard(clipboard);
  if (!file) return;
  const target = event.target;
  const editingText = target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type !== "file") || (target instanceof HTMLElement && target.isContentEditable);
  const text = (clipboard.getData("text/plain") || "").trim();
  if (editingText && text && clipboard.files.length === 0) return;
  event.preventDefault();
  event.stopPropagation();
  if (target instanceof HTMLInputElement && target.type === "file") target.blur();
  assignPastedImage(file);
}, true);

selectToolbar.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

memoPopover.addEventListener("submit", saveMemo);
memoInput.addEventListener("input", () => syncMemoPreview());

document.addEventListener("mouseup", (event) => {
  if (event.target instanceof Element && event.target.closest("#select-toolbar, #memo-popover, #note-popover, #note-actions, [data-inline-note]")) return;
  requestAnimationFrame(() => {
    if (penEdit) return;
    showToolbarFromSelection();
  });
});

document.addEventListener("mousedown", (event) => {
  if (event.target instanceof Element && event.target.closest("#select-toolbar, #memo-popover, #note-popover, #note-actions")) return;
  hideToolbar();
  hideNote();
  hideNoteActions();
  if (!memoPopover.hidden) {
    const marking = event.target instanceof Element && event.target.closest("[data-annotate]");
    dismissMemoPreview(Boolean(marking));
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const inline = event.target instanceof Element ? event.target.closest("[data-inline-note]") : null;
  if (!inline) return;
  event.preventDefault();
  event.stopPropagation();
  showNoteActions(inline);
});

emphasisColors?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hex]");
  if (!button || !isHexColor(button.dataset.hex)) return;
  event.preventDefault();
  event.stopPropagation();
  selectedMemoColor = button.dataset.hex.toUpperCase();
  syncMemoPalette();
});

memoStyles?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-style]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  selectedMemoStyle = memoStyle(button.dataset.style);
  syncMemoPalette();
});

document.addEventListener("click", (event) => {
  const inline = event.target instanceof Element ? event.target.closest("[data-inline-note]") : null;
  if (inline) {
    event.stopPropagation();
    showNoteActions(inline);
    return;
  }
  const wordMark = event.target instanceof Element ? event.target.closest("mark.pen") : null;
  const sentence = wordMark?.closest(".sentence-memo");
  if (wordMark && sentence) event.stopPropagation();
  if (eraserOn && event.target instanceof Element) {
    const root = event.target.closest("[data-annotate]");
    if (root) {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        if (annotateRoot(range) === root) {
          const start = textOffset(root, range.startContainer, range.startOffset);
          const end = textOffset(root, range.endContainer, range.endOffset);
          const from = Math.min(start, end);
          const to = Math.max(start, end);
          if (eraserMode === "sentence") {
            const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
            const opening = sentenceBounds(passage?.body || "", from);
            const closing = sentenceBounds(passage?.body || "", Math.max(to - 1, from));
            eraseRange(root, opening[0], closing[1], "sentence");
          } else {
            eraseRange(root, from, to, "word");
          }
          return;
        }
      }
      const index = offsetAtPoint(root, event.clientX, event.clientY);
      if (index != null) eraseAt(root, index, eraserMode);
      return;
    }
  }
  if (window.getSelection() && !window.getSelection().isCollapsed) return;
  const sentenceMark = event.target instanceof Element ? event.target.closest(".sentence-memo") : null;
  const markEl = wordMark || sentenceMark;
  if (!markEl?.dataset.mark || markEl.classList.contains("is-memo-preview")) return;
  event.stopPropagation();
  const root = markEl.closest("[data-annotate]");
  const saved = root ? marksFor(root.dataset.annotate).find((item) => item.id === markEl.dataset.mark) : null;
  if (saved && markStyle(saved) !== "box") {
    openPenEditor(markEl);
    return;
  }
  if (memoDisplay === "click") showSavedNote(markEl);
});

window.addEventListener("scroll", () => {
  hideToolbar();
  hideNote();
  hideNoteActions();
}, true);

window.addEventListener("resize", () => {
  placeInlineNotes();
  if (!memoDraft?.root?.isConnected || memoPopover.hidden) return;
  const rect = memoPreviewRect(memoDraft.root);
  if (rect) placeNear(memoPopover, rect);
});
document.fonts?.ready.then(() => placeInlineNotes()).catch(() => {});

assistantToggle.addEventListener("click", () => setAssistantOpen(!assistantState.open));
assistantForm.addEventListener("submit", askAssistant);
assistantQuestion.addEventListener("input", () => {
  assistantSend.disabled = assistantQuestion.value.trim().length === 0;
});
assistantQuestion.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    assistantForm.requestSubmit();
  }
});

window.addEventListener("hashchange", render);
if (!location.hash) location.hash = embedded ? "#/notes" : "#/";
else render();
