const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const envFile = path.join(root, "..", ".env");
const port = Number(process.env.PORT) || 4173;
const model = () => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const SYSTEM_PROMPT = `당신은 EngSel 엥셀의 영어 내신 학습 도우미입니다.
학생의 질문에 한국어로 짧고 분명하게 답합니다.
문법, 어휘, 해석, 본문 이해를 설명할 때는 근거가 되는 영어 표현을 함께 보여 줍니다.
현재 본문이 주어지면 그 내용을 우선해서 답하고, 본문에 없는 내용은 없다고 말합니다.`;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 100000) {
        reject(new Error("too-large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseRequest(raw) {
  let json;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { error: "질문을 받지 못했습니다.", status: 400 };
  }
  const messages = Array.isArray(json.messages) ? json.messages : [];
  if (!messages.length || messages.length > 20) {
    return { error: "질문 내용을 확인해 주세요.", status: 400 };
  }
  const clean = [];
  for (const message of messages) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "user" ? "user" : "";
    const content = typeof message?.content === "string" ? message.content.trim() : "";
    if (!role || !content || content.length > 4000) {
      return { error: "질문 내용을 확인해 주세요.", status: 400 };
    }
    clean.push({ role, content });
  }
  if (clean.at(-1).role !== "user") {
    return { error: "질문 내용을 확인해 주세요.", status: 400 };
  }
  const passage = json.passage;
  const safePassage =
    passage && typeof passage.title === "string" && typeof passage.body === "string"
      ? { title: passage.title.slice(0, 200), body: passage.body.slice(0, 12000) }
      : null;
  return { messages: clean, passage: safePassage };
}

function parseTranslateRequest(raw) {
  let json;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { error: "문장을 받지 못했습니다.", status: 400 };
  }
  const sentences = Array.isArray(json.sentences) ? json.sentences : [];
  if (!sentences.length || sentences.length > 80) {
    return { error: "해석할 문장을 확인해 주세요.", status: 400 };
  }
  const clean = [];
  for (const sentence of sentences) {
    const text = typeof sentence === "string" ? sentence.trim() : "";
    if (!text || text.length > 1000) return { error: "해석할 문장을 확인해 주세요.", status: 400 };
    clean.push(text);
  }
  return { sentences: clean };
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

function parseFlowRequest(raw) {
  let json;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { error: "문장을 받지 못했습니다.", status: 400 };
  }
  const sentences = Array.isArray(json.sentences) ? json.sentences : [];
  if (sentences.length < 2 || sentences.length > 80) {
    return { error: "나눌 문장을 확인해 주세요.", status: 400 };
  }
  const clean = [];
  for (const sentence of sentences) {
    const text = typeof sentence === "string" ? sentence.trim() : "";
    if (!text || text.length > 2000) return { error: "나눌 문장을 확인해 주세요.", status: 400 };
    clean.push(text);
  }
  return { sentences: clean };
}

function parseFlowGroups(text, count) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (flowGroupsCover(parsed, count)) return parsed;
    if (Array.isArray(parsed) && parsed[0]?.[0] === 1) {
      const shifted = parsed.map((group) => [group[0] - 1, group[1] - 1]);
      if (flowGroupsCover(shifted, count)) return shifted;
    }
    return null;
  } catch {
    return null;
  }
}

async function segmentFlow(sentences) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 흐름을 나누지 못했습니다." } };
  }
  const numbered = sentences.map((sentence, index) => `${index}. ${sentence}`).join("\n");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 영어 독해 본문을 의미 흐름에 따라 묶습니다. 원문의 줄바꿈이나 문단 나눔은 무시하고, 주제·주장·시간·목적이 바뀔 때만 새 구간을 시작하세요. 문장마다 자르지 마세요. 0부터 시작하는 문장 번호를 [시작, 끝] 포함 구간으로 이어서, 모든 문장을 빠짐없이 한 번씩만 덮는 JSON 배열만 출력하세요. 예: [[0,2],[3,5]]",
          }],
        },
        contents: [{ role: "user", parts: [{ text: numbered }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Flow request failed", response.status);
    return { status: 502, body: { error: "의미 흐름을 나누지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const groups = parseFlowGroups(replyText(payload), sentences.length);
  if (!groups) {
    return { status: 502, body: { error: "의미 흐름을 문장 순서에 맞추지 못했습니다." } };
  }
  return { status: 200, body: { groups } };
}

function parseFlowFeedback(text) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const comparison = typeof parsed.comparison === "string" ? parsed.comparison.trim() : "";
    if (!summary || summary.length > 1200 || !comparison || comparison.length > 2000) return null;
    return { summary, comparison };
  } catch {
    return null;
  }
}

function parseFlowFeedbackRequest(raw) {
  let json;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { error: "정리 내용을 받지 못했습니다.", status: 400 };
  }
  const text = typeof json.text === "string" ? json.text.trim() : "";
  const summary = typeof json.summary === "string" ? json.summary.trim() : "";
  if (!text || text.length > 8000 || !summary || summary.length > 2000) {
    return { error: "비교할 내용이 없거나 너무 깁니다.", status: 400 };
  }
  return { text, summary };
}

async function reviewFlowSummary(text, summary) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 피드백을 만들지 못했습니다." } };
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 한국 고등학생의 영어 지문을 돕는 친근하고 전문적인 선생님입니다. 영어 흐름 블록의 핵심을 한국어 2~3문장으로 요약하고, 학생이 적은 한국어 핵심 생각과 비교합니다. 핵심을 잘 잡았으면 구체적으로 칭찬하고, 빠뜨린 중요한 내용이나 오해가 있으면 부드럽게 보완합니다. 학습 동기가 이어지도록 격려를 포함합니다. JSON만 출력합니다. 형식은 {\"summary\":\"AI 핵심 요약\",\"comparison\":\"비교 및 피드백\"} 입니다. 코드 블록이나 다른 설명은 넣지 않습니다.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{ text: `영어 지문:\n${text}\n\n학생 요약:\n${summary}` }],
        }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Flow feedback failed", response.status);
    return { status: 502, body: { error: "피드백을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const review = parseFlowFeedback(replyText(payload));
  if (!review) {
    return { status: 502, body: { error: "피드백을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  return { status: 200, body: review };
}

function parseTranslationList(text, count) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length !== count) return null;
    if (!parsed.every((item) => typeof item === "string" && item.trim())) return null;
    return parsed.map((item) => item.trim());
  } catch {
    return null;
  }
}

async function translateSentences(sentences) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 해석을 만들 수 없습니다." } };
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 영어 본문을 한국어로 해석합니다. 입력된 문장 순서와 개수를 그대로 유지하고, JSON 문자열 배열만 출력합니다. 설명, 번호, 코드 블록은 넣지 않습니다.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{ text: JSON.stringify(sentences) }],
        }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Translation request failed", response.status);
    return { status: 502, body: { error: "해석을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const translations = parseTranslationList(replyText(payload), sentences.length);
  if (!translations) {
    return { status: 502, body: { error: "해석을 문장 수에 맞추지 못했습니다." } };
  }
  return { status: 200, body: { translations } };
}

function parseVocabularyList(text) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    const words = [];
    for (const item of parsed) {
      const word = typeof item?.word === "string" ? item.word.trim() : "";
      const partOfSpeech = typeof item?.partOfSpeech === "string" ? item.partOfSpeech.trim() : "";
      const meaning = typeof item?.meaning === "string" ? item.meaning.trim() : "";
      if (!word || word.length > 80 || !partOfSpeech || !meaning || meaning.length > 200) continue;
      const synonyms = Array.isArray(item?.synonyms)
        ? item.synonyms.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()).slice(0, 4)
        : [];
      words.push({ word, partOfSpeech, meaning, synonyms });
      if (words.length === 10) break;
    }
    return words.length >= 5 ? words : null;
  } catch {
    return null;
  }
}

async function extractVocabulary(passage) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 단어를 고를 수 없습니다." } };
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 한국 고등학생의 영어 내신과 수능을 돕는 어휘 선생님입니다. 본문에 실제로 나온 핵심 어휘 8개를 원형으로 고르세요. 너무 쉬운 기능어는 빼세요. JSON 배열만 출력합니다. 각 항목은 word, partOfSpeech, meaning, synonyms 필드를 가집니다. partOfSpeech와 meaning은 한국어이고, meaning은 이 본문 문맥의 뜻입니다. synonyms는 영어 동의어 배열이며 없으면 빈 배열입니다.",
          }],
        },
        contents: [{ role: "user", parts: [{ text: passage }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Vocabulary request failed", response.status);
    return { status: 502, body: { error: "단어를 고르지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const words = parseVocabularyList(replyText(payload));
  if (!words) {
    return { status: 502, body: { error: "핵심 단어를 충분히 고르지 못했습니다." } };
  }
  return { status: 200, body: { words } };
}

function parseWordLookup(text) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const partOfSpeech = typeof parsed?.partOfSpeech === "string" ? parsed.partOfSpeech.trim().slice(0, 20) : "";
    const meaning = typeof parsed?.meaning === "string" ? parsed.meaning.trim().slice(0, 200) : "";
    const synonyms = Array.isArray(parsed?.synonyms)
      ? parsed.synonyms.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim().slice(0, 40)).slice(0, 4)
      : [];
    if (!meaning) return null;
    return { partOfSpeech, meaning, synonyms };
  } catch {
    return null;
  }
}

async function lookupWord(word, context) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 뜻을 찾을 수 없습니다." } };
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 한국 고등학생의 영어 단어장 선생님입니다. 주어진 영어 단어나 짧은 숙어의 품사, 한국어 뜻, 영어 유의어를 고르세요. JSON 객체만 출력합니다. 필드는 partOfSpeech, meaning, synonyms 입니다. partOfSpeech와 meaning은 한국어이고, meaning은 문맥에 맞는 짧은 뜻입니다. synonyms는 영어 유의어 배열이며 최대 4개, 없으면 빈 배열입니다. 영어 단어나 숙어가 아니면 meaning은 빈 문자열입니다.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{ text: `단어: ${word}\n문맥: ${context || "없음"}` }],
        }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Word lookup failed", response.status);
    return { status: 502, body: { error: "뜻을 찾지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const entry = parseWordLookup(replyText(payload));
  if (!entry) {
    return { status: 422, body: { error: "이 표현의 뜻을 찾지 못했습니다." } };
  }
  return { status: 200, body: entry };
}

function parseQuizDraft(text, passage) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    const lower = passage.toLowerCase();
    const items = [];
    const used = [];
    for (const item of parsed) {
      const phrase = typeof item?.phrase === "string" ? item.phrase.trim() : "";
      const distractor = typeof item?.distractor === "string" ? item.distractor.trim() : "";
      if (!phrase || !distractor || phrase.length > 48 || distractor.length > 48) continue;
      if (phrase.toLowerCase() === distractor.toLowerCase()) continue;
      if (/[\[\]/]/.test(phrase) || /[\[\]/]/.test(distractor)) continue;
      const at = lower.indexOf(phrase.toLowerCase());
      if (at < 0) continue;
      const stop = at + phrase.length;
      if (used.some(([from, to]) => at < to && stop > from)) continue;
      used.push([at, stop]);
      items.push({ phrase, distractor });
      if (items.length === 8) break;
    }
    return items.length ? items : null;
  } catch {
    return null;
  }
}

async function draftQuiz(kind, passage) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 문제를 만들지 못했습니다." } };
  }
  const instruction = kind === "grammar"
    ? "당신은 한국 고등학교 영어 내신 어법 출제자입니다. 본문에서 수일치, 분사, 관계사, to부정사·동명사, 수동태, 접속사 중 실제로 드러나는 표현만 최대 8개 고르세요. phrase는 본문에 있는 연속 표현을 한 글자도 바꾸지 말고 그대로 복사합니다. distractor는 그 자리에서 학생이 틀리기 쉬운 다른 형태입니다. JSON 배열만 출력합니다. 예: [{\"phrase\":\"were led\",\"distractor\":\"led\"}]"
    : "당신은 한국 고등학교 영어 내신 어휘 출제자입니다. 본문에 실제로 있는 핵심 내용어를 최대 8개 고르세요. 기능어와 너무 쉬운 단어는 빼세요. phrase는 본문의 단어를 그대로 복사합니다. distractor는 문맥에는 안 맞지만 품사와 난이도가 비슷한 다른 영어 단어입니다. JSON 배열만 출력합니다. 예: [{\"phrase\":\"innovation\",\"distractor\":\"imitation\"}]";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ role: "user", parts: [{ text: passage }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Quiz draft failed", response.status);
    return { status: 502, body: { error: "문제를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const items = parseQuizDraft(replyText(payload), passage);
  if (!items) {
    return { status: 502, body: { error: "본문에서 문제를 고르지 못했습니다." } };
  }
  return { status: 200, body: { items } };
}

const WRITTEN_TYPES = new Set(["key", "condition", "summary"]);
const WRITTEN_TITLES = { key: "핵심 문장 영작", condition: "조건 영작", summary: "내용 요약" };

function clipText(value, max) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > max) return "";
  return text;
}

function clipList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  const items = [];
  for (const entry of value) {
    const text = clipText(entry, maxLen);
    if (!text || items.includes(text)) continue;
    items.push(text);
    if (items.length === maxItems) break;
  }
  return items;
}

function parseJsonBlock(text) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = Math.min(
    ...["{", "["].map((mark) => {
      const at = cleaned.indexOf(mark);
      return at < 0 ? Number.POSITIVE_INFINITY : at;
    }),
  );
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (!Number.isFinite(start) || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseWrittenItems(text) {
  const parsed = parseJsonBlock(text);
  if (!Array.isArray(parsed)) return null;
  const items = [];
  const seen = new Set();
  for (const item of parsed) {
    const type = typeof item?.type === "string" ? item.type.trim() : "";
    if (!WRITTEN_TYPES.has(type) || seen.has(type)) continue;
    const prompt = clipText(item?.prompt, 600);
    const modelAnswer = clipText(item?.model, 900);
    const conditions = clipList(item?.conditions, 5, 180);
    const keywords = clipList(item?.keywords, 8, 48);
    const title = clipText(item?.title, 40) || WRITTEN_TITLES[type];
    if (!prompt || !modelAnswer || modelAnswer.split(/\s+/).length < 4 || !conditions.length) continue;
    seen.add(type);
    items.push({ type, title, prompt, conditions, keywords, model: modelAnswer });
  }
  items.sort((a, b) => ["key", "condition", "summary"].indexOf(a.type) - ["key", "condition", "summary"].indexOf(b.type));
  return items.length >= 2 ? items : null;
}

async function draftWritten(passage) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 서술형 문제를 만들지 못했습니다." } };
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 한국 고등학교 영어 내신 서술형 출제자입니다. 주어진 영어 본문만 근거로 문제를 만듭니다. type이 key, condition, summary인 문제 3개를 JSON 배열로만 출력합니다. key는 핵심 문장 영작입니다. 본문 내용을 한국어 지시로 묻고, 학생은 영어 한 문장으로 답합니다. condition은 조건 영작입니다. 반드시 넣을 영어 단어나 문법 조건을 conditions에 적습니다. summary는 내용 요약입니다. 본문 전체를 영어 두 문장 이내로 요약하게 합니다. model은 채점용 영어 모범 답안입니다. keywords는 채점에 쓸 핵심 표현입니다. 본문에 없는 사실을 만들지 않습니다. 형식은 [{\"type\":\"key\",\"title\":\"핵심 문장 영작\",\"prompt\":\"지시문\",\"conditions\":[\"조건\"],\"keywords\":[\"표현\"],\"model\":\"모범 답안\"}] 입니다. 코드 블록이나 다른 설명은 넣지 않습니다.",
          }],
        },
        contents: [{ role: "user", parts: [{ text: passage }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Written quiz failed", response.status);
    return { status: 502, body: { error: "서술형 문제를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const items = parseWrittenItems(replyText(payload));
  if (!items) {
    return { status: 502, body: { error: "서술형 문제를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  return { status: 200, body: { items } };
}

function parseWrittenReview(text) {
  const parsed = parseJsonBlock(text);
  if (!parsed || Array.isArray(parsed)) return null;
  const score = Number(parsed.score);
  if (!Number.isFinite(score)) return null;
  const praise = clipText(parsed.praise, 700);
  const gap = clipText(parsed.gap, 700);
  const revision = clipText(parsed.revision, 900);
  if (!praise || !gap || !revision) return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    praise,
    gap,
    revision,
  };
}

function parseWrittenReviewRequest(raw) {
  let json;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { error: "답안을 받지 못했습니다.", status: 400 };
  }
  const passage = clipText(json.passage, 12000);
  const prompt = clipText(json.prompt, 600);
  const modelAnswer = clipText(json.model, 900);
  const answer = typeof json.answer === "string" ? json.answer.trim() : "";
  const conditions = clipList(json.conditions, 5, 180);
  const keywords = clipList(json.keywords, 8, 48);
  if (!passage || !prompt || !modelAnswer || !answer || answer.length > 2000) {
    return { error: "비교할 답안을 확인해 주세요.", status: 400 };
  }
  return { passage, prompt, model: modelAnswer, answer, conditions, keywords };
}

async function reviewWritten(input) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "GEMINI_API_KEY가 없어 답안을 분석하지 못했습니다." } };
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 한국 고등학교 영어 서술형 채점 교사입니다. 학생 답안을 모범 답안과 비교해 의미, 문법, 핵심 키워드 포함 여부를 함께 봅니다. score는 0부터 100까지의 정수이며, 의미가 얼마나 일치하는지를 나타냅니다. 의미가 같고 문법만 약간 어색하면 70 이상, 핵심 내용이 빠지거나 본문과 어긋나면 그만큼 낮춥니다. 철자 한두 개 차이는 크게 깎지 않습니다. praise는 잘 쓴 부분을 구체적으로 칭찬하고, gap은 부족하거나 틀린 부분을 부드럽게 짚습니다. revision은 학생 답안의 뉘앙스를 살리면서 원어민 표현과 채점 기준에 맞게 다듬은 영어 문장입니다. 요약 문제면 revision도 두 문장 이내를 유지합니다. praise와 gap은 한국어로 씁니다. JSON만 출력합니다. 형식은 {\"score\":85,\"praise\":\"잘한 점\",\"gap\":\"부족한 점\",\"revision\":\"다듬은 영어 답안\"} 입니다.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{
            text: `본문:\n${input.passage}\n\n문제:\n${input.prompt}\n\n조건:\n${input.conditions.join("\n") || "없음"}\n\n핵심 표현:\n${input.keywords.join(", ") || "없음"}\n\n모범 답안:\n${input.model}\n\n학생 답안:\n${input.answer}`,
          }],
        }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Written review failed", response.status);
    return { status: 502, body: { error: "답안을 분석하지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const review = parseWrittenReview(replyText(payload));
  if (!review) {
    return { status: 502, body: { error: "피드백을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  return { status: 200, body: review };
}

function replyText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  const visible = parts.filter((part) => part && typeof part.text === "string" && !part.thought);
  const chosen = visible.length ? visible : parts.filter((part) => part && typeof part.text === "string");
  return chosen.map((part) => part.text).join("").trim();
}

async function askGemini(messages, passage) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      status: 500,
      body: { error: "GEMINI_API_KEY가 없어 도우미가 답할 수 없습니다. 프로젝트 폴더의 .env를 확인해 주세요." },
    };
  }
  const passageNote = passage ? `\n\n현재 본문 제목: ${passage.title}\n현재 본문:\n${passage.body}` : "";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}${passageNote}` }] },
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Gemini request failed", response.status);
    return { status: 502, body: { error: "도우미가 답을 하지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const text = replyText(payload);
  if (!text) {
    return { status: 502, body: { error: "도우미가 답을 만들지 못했습니다." } };
  }
  return { status: 200, body: { text } };
}

function serveFile(req, res) {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/") url = "/index.html";
  const file = path.join(root, url);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

loadEnv(envFile);

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/api/flow") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "의미 흐름을 요청하지 못했습니다." });
      return;
    }
    try {
      const parsed = parseFlowRequest(await readBody(req));
      if (parsed.error) {
        sendJson(res, parsed.status, { error: parsed.error });
        return;
      }
      const result = await segmentFlow(parsed.sentences);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "본문이 너무 깁니다." });
        return;
      }
      console.error("Flow segmentation failed");
      sendJson(res, 502, { error: "의미 흐름을 나누지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/flow-feedback") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "피드백을 요청하지 못했습니다." });
      return;
    }
    try {
      const parsed = parseFlowFeedbackRequest(await readBody(req));
      if (parsed.error) {
        sendJson(res, parsed.status, { error: parsed.error });
        return;
      }
      const result = await reviewFlowSummary(parsed.text, parsed.summary);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "정리 내용이 너무 깁니다." });
        return;
      }
      console.error("Flow feedback failed");
      sendJson(res, 502, { error: "피드백을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/translate") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "해석을 요청하지 못했습니다." });
      return;
    }
    try {
      const parsed = parseTranslateRequest(await readBody(req));
      if (parsed.error) {
        sendJson(res, parsed.status, { error: parsed.error });
        return;
      }
      const result = await translateSentences(parsed.sentences);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "본문이 너무 깁니다." });
        return;
      }
      console.error("Translation failed");
      sendJson(res, 502, { error: "해석을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/quiz-draft") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "문제를 요청하지 못했습니다." });
      return;
    }
    try {
      const raw = await readBody(req);
      let json;
      try {
        json = JSON.parse(raw || "{}");
      } catch {
        sendJson(res, 400, { error: "본문을 받지 못했습니다." });
        return;
      }
      const kind = json.kind === "grammar" || json.kind === "vocabulary" ? json.kind : "";
      const passage = typeof json.passage === "string" ? json.passage.trim() : "";
      if (!kind || !passage || passage.length > 12000) {
        sendJson(res, 400, { error: "문제로 만들 본문을 확인해 주세요." });
        return;
      }
      const result = await draftQuiz(kind, passage);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "본문이 너무 깁니다." });
        return;
      }
      console.error("Quiz draft failed");
      sendJson(res, 502, { error: "문제를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/written") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "서술형 문제를 요청하지 못했습니다." });
      return;
    }
    try {
      const raw = await readBody(req);
      let json;
      try {
        json = JSON.parse(raw || "{}");
      } catch {
        sendJson(res, 400, { error: "본문을 받지 못했습니다." });
        return;
      }
      const passage = typeof json.passage === "string" ? json.passage.trim() : "";
      if (!passage || passage.length > 12000) {
        sendJson(res, 400, { error: "문제로 만들 본문을 확인해 주세요." });
        return;
      }
      const result = await draftWritten(passage);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "본문이 너무 깁니다." });
        return;
      }
      console.error("Written quiz failed");
      sendJson(res, 502, { error: "서술형 문제를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/written-feedback") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "답안을 보내지 못했습니다." });
      return;
    }
    try {
      const parsed = parseWrittenReviewRequest(await readBody(req));
      if (parsed.error) {
        sendJson(res, parsed.status, { error: parsed.error });
        return;
      }
      const result = await reviewWritten(parsed);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "답안이 너무 깁니다." });
        return;
      }
      console.error("Written review failed");
      sendJson(res, 502, { error: "답안을 분석하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/word-lookup") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "뜻을 요청하지 못했습니다." });
      return;
    }
    try {
      const raw = await readBody(req);
      let json;
      try {
        json = JSON.parse(raw || "{}");
      } catch {
        sendJson(res, 400, { error: "단어를 받지 못했습니다." });
        return;
      }
      const word = typeof json.word === "string" ? json.word.replace(/\s+/g, " ").trim() : "";
      const context = typeof json.context === "string" ? json.context.replace(/\s+/g, " ").trim().slice(0, 500) : "";
      if (!word || word.length > 80) {
        sendJson(res, 400, { error: "뜻을 찾을 단어를 확인해 주세요." });
        return;
      }
      const result = await lookupWord(word, context);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "단어가 너무 깁니다." });
        return;
      }
      console.error("Word lookup failed");
      sendJson(res, 502, { error: "뜻을 찾지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/vocabulary") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "단어를 요청하지 못했습니다." });
      return;
    }
    try {
      const raw = await readBody(req);
      let json;
      try {
        json = JSON.parse(raw || "{}");
      } catch {
        sendJson(res, 400, { error: "본문을 받지 못했습니다." });
        return;
      }
      const passage = typeof json.passage === "string" ? json.passage.trim() : "";
      if (!passage || passage.length > 12000) {
        sendJson(res, 400, { error: "단어로 만들 본문을 확인해 주세요." });
        return;
      }
      const result = await extractVocabulary(passage);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "본문이 너무 깁니다." });
        return;
      }
      console.error("Vocabulary failed");
      sendJson(res, 502, { error: "단어를 고르지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (url === "/api/assistant") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "질문을 보내지 못했습니다." });
      return;
    }
    try {
      const parsed = parseRequest(await readBody(req));
      if (parsed.error) {
        sendJson(res, parsed.status, { error: parsed.error });
        return;
      }
      const result = await askGemini(parsed.messages, parsed.passage);
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof Error && error.message === "too-large") {
        sendJson(res, 413, { error: "질문이 너무 깁니다." });
        return;
      }
      console.error("Assistant reply failed");
      sendJson(res, 502, { error: "도우미가 답을 하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  serveFile(req, res);
});

server.listen(port, () => {
  console.log(`ready ${port} gemini=${process.env.GEMINI_API_KEY ? "yes" : "no"}`);
});
