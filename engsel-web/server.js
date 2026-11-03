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
