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
  { href: "/analytics", title: "약점 분석", detail: "총점 대신 어휘, 문법, 해석처럼 영역별로 충분히 익힌 부분과 다시 볼 부분을 구분합니다." },
  { href: "/assistant", title: "도우미", detail: "본문과 문제를 보다가 궁금한 점이 생기면 앱 안의 도우미에게 도움을 요청합니다." },
];

const QUIZ_TABS = [
  { href: "/quiz", label: "해석", description: "업로드한 영어 본문을 문장별로 나누고, 한글 해석과 나란히 비교합니다." },
  { href: "/quiz/grammar", label: "어법 고르기", description: "본문에서 내신에 자주 나오는 어법 부분을 고르거나 고칩니다." },
  { href: "/quiz/vocabulary", label: "어휘 고르기", description: "본문 맥락에 맞는 단어와 숙어를 객관식이나 빈칸으로 고릅니다." },
  { href: "/quiz/past", label: "기출", description: "지난 시험 문제와 비슷한 유형을 풀고, 정답과 해설을 확인합니다." },
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
let memoDisplay = localStorage.getItem(MEMO_DISPLAY_KEY) === "inline" ? "inline" : "click";
let practiceItems = [];
let practicePassageId = "";
let practiceToken = 0;
let wordbookItems = [];
let wordbookPassageId = "";
let wordbookHideMeanings = true;
let wordbookFilter = "all";
let wordbookToken = 0;

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
      }));
  } catch {
    return [];
  }
}

function savePassages(passages) {
  localStorage.setItem(PASSAGES_KEY, JSON.stringify(passages));
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

function showNotice() {
  toastEl.hidden = false;
  toastEl.textContent = NOTICE;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 3200);
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
      <a class="${navClass(path, "/quiz")}" href="#/quiz" aria-haspopup="menu">문제 풀이</a>
      <div class="nav-drop" role="menu" aria-label="문제 유형">
        <div class="nav-drop-list">${items}</div>
      </div>
    </div>
  `;
}

function renderHeader(path, categoryId) {
  const category = categoryById(categoryId);
  const unlocked = Boolean(category) && path !== "/";
  const links = FEATURES.filter((feature) => feature.href !== "/assistant").map((feature) => {
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
        <div class="progress-label" style="margin-top:2rem">
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

function annotatedHtml(body, marks) {
  const text = String(body ?? "");
  const sorted = [...marks].sort((a, b) => a.start - b.start || a.end - b.end);
  let html = "";
  let cursor = 0;
  sorted.forEach((mark) => {
    const start = Math.max(mark.start, cursor);
    const end = Math.min(mark.end, text.length);
    if (start >= end) return;
    html += esc(text.slice(cursor, start));
    html += markedPieces(text, start, end, mark.id, Boolean(String(mark.note || "").trim()));
    if (memoDisplay === "inline" && String(mark.note || "").trim()) {
      html += `<span class="inline-note" data-inline-note="${esc(mark.id)}" role="button" tabindex="0"><span class="inline-note-label">메모</span>${esc(mark.note.trim())}</span>`;
    }
    cursor = end;
  });
  html += esc(text.slice(cursor));
  return html;
}

function markedPieces(text, start, end, id, noted) {
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
    if (/[A-Za-z0-9]/.test(token)) {
      html += `<mark class="pen${noted ? " memo" : ""}" data-mark="${esc(id)}">${esc(token)}</mark>`;
    } else {
      html += esc(token);
    }
    index = next;
  }
  return html;
}

function paintAnnotations(root) {
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  if (!passage) return;
  root.innerHTML = annotatedHtml(passage.body, marksFor(passage.id));
}

function commitMarks(root, marks) {
  const store = loadMarks();
  store[root.dataset.annotate] = marks;
  saveMarkStore(store);
  paintAnnotations(root);
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
  const probe = document.createRange();
  probe.setStart(root, 0);
  probe.setEnd(node, offset);
  let length = probe.toString().length;
  root.querySelectorAll("[data-inline-note]").forEach((note) => {
    if (!probe.intersectsNode(note)) return;
    const noteRange = document.createRange();
    noteRange.selectNodeContents(note);
    const noteEndsInside = probe.compareBoundaryPoints(Range.END_TO_END, noteRange) < 0;
    if (!noteEndsInside) {
      length -= note.textContent.length;
      return;
    }
    const partial = document.createRange();
    partial.setStart(note, 0);
    partial.setEnd(node, offset);
    length -= partial.toString().length;
  });
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

function placeNear(element, rect) {
  element.hidden = false;
  const box = element.getBoundingClientRect();
  let top = rect.top - box.height - 8;
  if (top < 8) top = rect.bottom + 8;
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - box.width / 2, window.innerWidth - box.width - 8));
  element.style.top = `${top}px`;
  element.style.left = `${left}px`;
}

function hideToolbar() {
  selectToolbar.hidden = true;
}

function hideMemo() {
  memoPopover.hidden = true;
  memoDraft = null;
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
  hideMemo();
  hideNote();
  placeNear(selectToolbar, captured.rect);
}

function highlightSelection(note = "") {
  if (!activeSelection) return null;
  const { root, from, to, markId } = activeSelection;
  let marks = marksFor(root.dataset.annotate);
  const exact = marks.find((mark) => mark.start === from && mark.end === to);
  if (exact && note === "") {
    hideToolbar();
    window.getSelection()?.removeAllRanges();
    activeSelection = null;
    return exact.id;
  }
  if (markId && note !== "" && exact?.id === markId) {
    marks = marks.map((mark) => (mark.id === markId ? { ...mark, note } : mark));
    commitMarks(root, marks);
    return markId;
  }
  const id = exact?.id || crypto.randomUUID();
  marks = splitAround(marks, from, to);
  marks.push({ id, start: from, end: to, note: note || exact?.note || "" });
  marks.sort((a, b) => a.start - b.start);
  commitMarks(root, marks);
  window.getSelection()?.removeAllRanges();
  activeSelection = null;
  hideToolbar();
  return id;
}

function openMemoEditor() {
  if (!activeSelection) return;
  const { root, from, to, rect, markId } = activeSelection;
  const existing = marksFor(root.dataset.annotate).find((mark) => mark.id === markId && mark.start === from && mark.end === to)
    || marksFor(root.dataset.annotate).find((mark) => mark.start === from && mark.end === to);
  memoDraft = { root, from, to, id: existing?.id || "" };
  memoInput.value = existing?.note || "";
  hideToolbar();
  hideNote();
  placeNear(memoPopover, rect);
  memoInput.focus();
}

function saveMemo(event) {
  event.preventDefault();
  if (!memoDraft) return;
  const note = memoInput.value.trim();
  const { root, from, to, id } = memoDraft;
  if (id) {
    const marks = marksFor(root.dataset.annotate).map((mark) => (mark.id === id ? { ...mark, note } : mark));
    commitMarks(root, marks);
  } else {
    activeSelection = { root, from, to, markId: "" };
    highlightSelection(note);
  }
  hideMemo();
}

function showSavedNote(mark) {
  const root = mark.closest("[data-annotate]");
  const saved = root ? marksFor(root.dataset.annotate).find((item) => item.id === mark.dataset.mark) : null;
  const note = saved?.note?.trim() || "";
  notePopoverText.textContent = note || "이 형광펜에는 메모가 없습니다.";
  noteTarget = note && root ? { root, id: mark.dataset.mark } : null;
  notePopoverActions.hidden = !note;
  hideToolbar();
  hideMemo();
  hideNoteActions();
  placeNear(notePopover, mark.getBoundingClientRect());
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
  hideToolbar();
  hideNote();
  hideNoteActions();
  placeNear(memoPopover, rect);
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
      <button type="button" class="ghost" data-action="go-back">뒤로가기</button>
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

function cutMarks(marks, text, from, to) {
  const next = [];
  const push = (item, start, end) => {
    const kept = tidyPiece(text, start, end);
    if (kept) next.push({ ...item, start: kept[0], end: kept[1] });
  };
  marks.forEach((item) => {
    if (item.end <= from || item.start >= to) {
      push(item, item.start, item.end);
      return;
    }
    if (item.start < from) push(item, item.start, from);
    if (item.end > to) push({ ...item, id: crypto.randomUUID() }, to, item.end);
  });
  return next;
}

function eraseRange(root, from, to) {
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  if (!passage || from >= to) return;
  commitMarks(root, cutMarks(marksFor(passage.id), passage.body, from, to));
  hideNote();
  hideToolbar();
  window.getSelection()?.removeAllRanges();
}

function eraseAt(root, index, mode) {
  const passage = loadPassages().find((item) => item.id === root.dataset.annotate);
  if (!passage) return;
  if (mode === "sentence") {
    const [start, end] = sentenceBounds(passage.body, index);
    eraseRange(root, start, end);
    return;
  }
  const bounds = wordBounds(passage.body, index >= passage.body.length ? passage.body.length - 1 : index);
  if (!bounds) return;
  eraseRange(root, bounds[0], bounds[1]);
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
      <p class="passage-body" data-annotate="${esc(passage.id)}" lang="en">${annotatedHtml(passage.body, marksFor(passage.id))}</p>
    </section>
  `;
}

function renderPassage(categoryId) {
  const body = draftBody();
  const canSave = body.trim().length > 0 && draft.ocrState !== "loading";
  const passages = loadPassages();
  const groups = CATEGORIES.map((category) => ({
    category,
    items: passages.filter((item) => item.categoryId === category.id),
  })).filter((group) => group.items.length > 0);
  const list = groups.length
    ? groups.map(({ category, items }) => `
        <section>
          <h3 class="tiny">${esc(category.label)} · ${items.length}개</h3>
          <div class="stack">
            ${items.map((passage) => {
              const selected = passage.id === activePassageId();
              return `
                <article class="passage-item${selected ? " is-selected" : ""}">
                  <button type="button" class="title" data-action="select-passage" data-id="${esc(passage.id)}" aria-pressed="${selected}">
                    <span class="between"><strong>${esc(passage.title)}</strong>${selected ? '<span class="kicker">학습 중</span>' : ""}</span>
                    <span class="tiny">${esc(dateFormat.format(new Date(passage.createdAt)))}</span>
                    <span class="clamp">${esc(passage.body)}</span>
                  </button>
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
      `).join("")
    : `<p class="lead">아직 저장된 본문이 없습니다.</p>`;

  const textPanel = `
    <div>
      <label class="field" for="passage-body">영어 본문
        <textarea id="passage-body" data-field="passage-body" class="plain-text" lang="en" rows="12" placeholder="영어 본문을 붙여 넣으세요."></textarea>
      </label>
    </div>
  `;
  const imagePanel = `
    <div>
      <div class="dropzone" data-dropzone="image" tabindex="0">
        <strong>이미지를 끌어다 놓거나, 파일을 고르거나, 붙여 넣으세요</strong>
        <span class="tiny">PNG, JPG, WEBP, GIF · 8MB 이하 · Ctrl+V</span>
        <label class="ghost" style="margin-top:1rem">
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
          <p class="kicker">${draft.editingId ? "본문 수정" : "본문 등록"}</p>
          <h1>${draft.editingId ? "저장한 본문 고치기" : "본문 업로드"}</h1>
          <p class="lead">영어 본문을 붙여 넣거나, 교과서 사진을 올리면 글자를 읽어 옵니다. 내용을 확인한 뒤 저장하세요.</p>
          <div class="tabs" role="tablist" aria-label="입력 방식">
            <button type="button" data-action="passage-mode" data-mode="text" aria-selected="${draft.mode === "text"}">텍스트 직접 입력</button>
            <button type="button" data-action="passage-mode" data-mode="image" aria-selected="${draft.mode === "image"}">이미지 업로드</button>
          </div>
          <label class="field" for="passage-title">제목 <span class="tiny">필수</span>
            <input id="passage-title" data-field="passage-title" class="plain-input" placeholder="예: Lesson 3 The Power of Words" required>
          </label>
          <div style="margin-top:1.25rem">${draft.mode === "text" ? textPanel : imagePanel}</div>
          ${draft.message ? `<p class="message ${esc(draft.messageTone)}" role="status">${esc(draft.message)}</p>` : ""}
          <div class="between" style="margin-top:1.25rem">
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
  document.title = "본문 업로드 · EngSel 엥셀";
}

function imageReview() {
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
        <div class="reader-body" data-annotate="${esc(current.id)}" lang="en">${annotatedHtml(current.body, marksFor(current.id))}</div>
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
        <p class="kicker">학습</p>
        <h1>학습 노트</h1>
        <p class="lead">본문을 펼쳐 읽고, 글자를 드래그해 표시할 수 있습니다.</p>
      </div>
      ${passagePicker(categoryId)}
      ${reader}
    </div>
  `;
  document.title = "학습 노트 · EngSel 엥셀";
}

function renderQuiz(path, categoryId) {
  const tab = QUIZ_TABS.find((item) => item.href === path) || QUIZ_TABS[0];
  const body = path === "/quiz"
    ? practiceSection(categoryId)
    : path === "/quiz/wordbook"
      ? wordbookSection(categoryId)
      : `
      <section class="panel">
        <h2>${esc(tab.label)}</h2>
        <p>여기는 ${esc(tab.label)} 화면입니다.</p>
        <p class="lead">${esc(tab.description)}</p>
      </section>
    `;
  viewEl.innerHTML = `
    <div class="wrap page stack">
      <div>
        <p class="kicker">학습</p>
        <h1>문제 풀이</h1>
        <p class="lead">저장한 본문을 바탕으로 해석, 어법, 어휘, 기출, 단어장을 오가며 공부합니다.</p>
      </div>
      ${passagePicker(categoryId)}
      <nav class="subnav" aria-label="문제 풀이 메뉴">
        ${QUIZ_TABS.map((item) => `<a href="#${item.href}" ${item.href === tab.href ? 'aria-current="page"' : ""}>${esc(item.label)}</a>`).join("")}
      </nav>
      ${body}
    </div>
  `;
  document.title = `${tab.label} · 문제 풀이 · EngSel 엥셀`;
  if (path === "/quiz" && practicePassageId) loadPracticeAnswers(practicePassageId, practiceToken);
  if (path === "/quiz/wordbook" && wordbookPassageId) loadWordbook(wordbookPassageId, wordbookToken);
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

function wordbookCards() {
  const visible = wordbookItems.filter((item) => wordbookFilter !== "saved" || item.saved);
  if (!wordbookItems.length) return "";
  if (!visible.length) return `<p class="lead">내 단어장에 담은 단어가 없습니다.</p>`;
  return `
    <ul class="word-list">
      ${visible.map((item) => {
        const index = wordbookItems.indexOf(item);
        const covered = wordbookHideMeanings && !item.revealed;
        return `
          <li class="word-card${item.memorized ? " is-memorized" : ""}">
            <div class="word-card-head">
              <div>
                <p class="word-card-word" lang="en">${esc(item.word)}</p>
                <p class="word-card-pos">${esc(item.partOfSpeech)}</p>
              </div>
              <label class="word-check" data-action="toggle-memorized" data-index="${index}">
                <input type="checkbox"${item.memorized ? " checked" : ""}>
                외움
              </label>
            </div>
            <button type="button" class="word-meaning${covered ? " is-covered" : ""}" data-action="reveal-meaning" data-index="${index}" aria-expanded="${covered ? "false" : "true"}">${covered ? "뜻을 보려면 누르세요" : esc(item.meaning)}</button>
            ${item.synonyms.length ? `<p class="word-synonyms">동의어 ${esc(item.synonyms.join(", "))}</p>` : ""}
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
  })).filter((item) => item.word && item.meaning);
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

function paintWordbook() {
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
  saveWordbook();
}

async function loadWordbook(passageId, token, force = false) {
  if (!force && wordbookItems.length) return;
  const passage = loadPassages().find((item) => item.id === passageId);
  const status = viewEl.querySelector("[data-live='wordbook-status']");
  const message = viewEl.querySelector("[data-live='wordbook-message']");
  if (!passage || token !== wordbookToken || wordbookPassageId !== passageId) return;
  if (status) status.hidden = false;
  if (message) message.textContent = "핵심 단어를 고르고 있습니다.";
  try {
    const words = await extractKeyVocabulary(passage.body);
    if (token !== wordbookToken || wordbookPassageId !== passageId) return;
    const previous = wordbookItems;
    wordbookItems = words.map((item) => {
      const old = previous.find((entry) => entry.word.toLowerCase() === item.word.toLowerCase());
      return {
        word: item.word,
        partOfSpeech: item.partOfSpeech,
        meaning: item.meaning,
        synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
        memorized: Boolean(old?.memorized),
        revealed: Boolean(old?.revealed),
        saved: Boolean(old?.saved),
      };
    });
    if (status) status.hidden = true;
    paintWordbook();
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
  const hidePassage = path === "/assistant" || path === "/plan" || path === "/analytics";
  viewEl.innerHTML = `
    <article class="wrap page stack" style="max-width:48rem">
      ${hidePassage ? "" : passagePicker(categoryId)}
      ${hidePassage ? "" : passageBanner()}
      <p class="kicker">아직 화면만 준비된 기능입니다.</p>
      <h1>${esc(feature.title)}</h1>
      <p class="lead">${esc(feature.detail)}</p>
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

  if (path === "/") setActiveCategory("");
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
  if (path !== "/passage") draft.imageOpen = false;

  renderHeader(path, categoryId);
  if (path === "/") renderHome();
  else if (path.startsWith("/study/")) renderStudy(studyId);
  else if (path === "/passage") {
    if (entered && !draft.editingId && categoryId) draft.categoryId = categoryId;
    renderPassage(categoryId);
  } else if (path === "/notes") renderNotes(categoryId);
  else if (path === "/quiz" || path.startsWith("/quiz/")) renderQuiz(path, categoryId);
  else renderFeature(path, categoryId);

  const hideAssistant = path === "/" || path.startsWith("/study/");
  const reviewingImage = path === "/passage" && draft.mode === "image" && draft.imageOpen && Boolean(draft.previewUrl);
  document.body.classList.toggle("is-reviewing-image", reviewingImage);
  headerEl.inert = reviewingImage;
  assistantEl.inert = reviewingImage;
  assistantEl.hidden = hideAssistant;
  if (hideAssistant) setAssistantOpen(false);
  window.clearInterval(clockTimer);
  if (path.startsWith("/study/")) clockTimer = window.setInterval(tickStudy, 1000);
}

function updateStudy(categoryId, patch) {
  const studies = loadStudies().map((item) => (item.categoryId === categoryId ? { ...item, ...patch } : item));
  saveStudies(studies);
}

function savePassage() {
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
  const passage = editing
    ? { ...editing, title, body, categoryId: draft.categoryId }
    : {
        id: crypto.randomUUID(),
        title,
        body,
        createdAt: new Date().toISOString(),
        categoryId: draft.categoryId,
      };
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
    highlightSelection();
    return;
  }
  if (action === "add-memo") {
    openMemoEditor();
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
    history.back();
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
  if (action === "retry-vocabulary") {
    loadWordbook(wordbookPassageId, wordbookToken, true);
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
    draft.imageOpen = true;
    render();
    viewEl.querySelector("#image-review-body")?.focus();
    return;
  }
  if (action === "close-image") {
    draft.imageOpen = false;
    render();
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
    clearDraft();
    draft.mode = "text";
    draft.categoryId = passage.categoryId;
    draft.title = passage.title;
    draft.textBody = passage.body;
    draft.editingId = passage.id;
    render();
    viewEl.querySelector(".passage-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (action === "delete-passage") {
    savePassages(loadPassages().filter((item) => item.id !== id));
    if (activePassageId() === id) setActivePassage("");
    if (draft.editingId === id) clearDraft();
    removeStudyNote(id);
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
  if (draft.imageOpen) {
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
  if (currentPath() !== "/passage" || draft.mode !== "image") return;
  const clipboard = event.clipboardData;
  const file = imageFileFromClipboard(clipboard);
  if (!file) return;
  const target = event.target;
  const editingText = target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type !== "file");
  const text = (clipboard.getData("text/plain") || "").trim();
  if (editingText && text && clipboard.files.length === 0) return;
  event.preventDefault();
  event.stopPropagation();
  if (target instanceof HTMLInputElement && target.type === "file") target.blur();
  acceptImage(namedPasteFile(file));
}, true);

selectToolbar.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

memoPopover.addEventListener("submit", saveMemo);

document.addEventListener("mouseup", (event) => {
  if (event.target instanceof Element && event.target.closest("#select-toolbar, #memo-popover, #note-popover, #note-actions, [data-inline-note]")) return;
  requestAnimationFrame(showToolbarFromSelection);
});

document.addEventListener("mousedown", (event) => {
  if (event.target instanceof Element && event.target.closest("#select-toolbar, #memo-popover, #note-popover, #note-actions")) return;
  hideToolbar();
  hideNote();
  hideNoteActions();
  if (!memoPopover.hidden) hideMemo();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const inline = event.target instanceof Element ? event.target.closest("[data-inline-note]") : null;
  if (!inline) return;
  event.preventDefault();
  showNoteActions(inline);
});

document.addEventListener("click", (event) => {
  const inline = event.target instanceof Element ? event.target.closest("[data-inline-note]") : null;
  if (inline) {
    showNoteActions(inline);
    return;
  }
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
            eraseRange(root, opening[0], closing[1]);
          } else {
            eraseRange(root, from, to);
          }
          return;
        }
      }
      const index = offsetAtPoint(root, event.clientX, event.clientY);
      if (index != null) eraseAt(root, index, eraserMode);
      return;
    }
  }
  if (memoDisplay !== "click") return;
  const mark = event.target instanceof Element ? event.target.closest("mark.pen") : null;
  if (!mark) return;
  if (window.getSelection() && !window.getSelection().isCollapsed) return;
  showSavedNote(mark);
});

window.addEventListener("scroll", () => {
  hideToolbar();
  hideNote();
  hideNoteActions();
}, true);

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
if (!location.hash) location.hash = "#/";
else render();
