import { hasGeminiKey } from "@/lib/ai/model";

type GeminiPart = { text?: string; thought?: boolean };
type GeminiPayload = { candidates?: { content?: { parts?: GeminiPart[] } }[] };
type Result = { status: number; body: Record<string, unknown> };

const WRITTEN_TYPES = new Set(["key", "condition", "summary"]);
const WRITTEN_TITLES: Record<string, string> = {
  key: "핵심 문장 영작",
  condition: "조건 영작",
  summary: "내용 요약",
};

function modelName() {
  hasGeminiKey();
  return process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
}

function replyText(payload: GeminiPayload) {
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  const visible = parts.filter((part) => part && typeof part.text === "string" && !part.thought);
  const chosen = visible.length ? visible : parts.filter((part) => part && typeof part.text === "string");
  return chosen.map((part) => part.text || "").join("").trim();
}

async function askGemini(system: string, user: string): Promise<Result | string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 500, body: { error: "GEMINI_API_KEY가 없어 요청을 처리하지 못했습니다." } };
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName())}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as GeminiPayload;
  if (!response.ok) return { status: 502, body: { error: "응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요." } };
  return replyText(payload);
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function respond(result: Result) {
  return Response.json(result.body, { status: result.status });
}

function flowGroupsCover(groups: unknown, count: number) {
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

function parseFlowGroups(text: string, count: number) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (flowGroupsCover(parsed, count)) return parsed;
    if (Array.isArray(parsed) && Array.isArray(parsed[0]) && parsed[0][0] === 1) {
      const shifted = parsed.map((group) => [Number(group[0]) - 1, Number(group[1]) - 1]);
      if (flowGroupsCover(shifted, count)) return shifted;
    }
    return null;
  } catch {
    return null;
  }
}

function parseTranslationList(text: string, count: number) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== count) return null;
    if (!parsed.every((item) => typeof item === "string" && item.trim())) return null;
    return parsed.map((item) => item.trim());
  } catch {
    return null;
  }
}

function parseFlowFeedback(text: string) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = asRecord(JSON.parse(cleaned.slice(start, end + 1)));
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    const comparison = typeof parsed?.comparison === "string" ? parsed.comparison.trim() : "";
    if (!summary || summary.length > 1200 || !comparison || comparison.length > 2000) return null;
    return { summary, comparison };
  } catch {
    return null;
  }
}

function clipText(value: unknown, max: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > max) return "";
  return text;
}

function clipList(value: unknown, maxItems: number, maxLen: number) {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    const text = clipText(entry, maxLen);
    if (!text || items.includes(text)) continue;
    items.push(text);
    if (items.length === maxItems) break;
  }
  return items;
}

function parseJsonBlock(text: string) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const starts = ["{", "["].map((mark) => cleaned.indexOf(mark)).filter((at) => at >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function cleanSentences(value: unknown, min: number, max: number, limit: number) {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null;
  const clean: string[] = [];
  for (const sentence of value) {
    const text = typeof sentence === "string" ? sentence.trim() : "";
    if (!text || text.length > limit) return null;
    clean.push(text);
  }
  return clean;
}

export async function postTranslate(request: Request) {
  const json = await readJson(request);
  const sentences = cleanSentences(asRecord(json)?.sentences, 1, 80, 1000);
  if (!sentences) return Response.json({ error: "해석할 문장을 확인해 주세요." }, { status: 400 });
  try {
    const text = await askGemini(
      "당신은 영어 본문을 한국어로 해석합니다. 입력된 문장 순서와 개수를 그대로 유지하고, JSON 문자열 배열만 출력합니다. 설명, 번호, 코드 블록은 넣지 않습니다.",
      JSON.stringify(sentences),
    );
    if (typeof text !== "string") return respond(text);
    const translations = parseTranslationList(text, sentences.length);
    if (!translations) return Response.json({ error: "해석을 문장 수에 맞추지 못했습니다." }, { status: 502 });
    return Response.json({ translations });
  } catch (error) {
    console.error("Translation failed", error);
    return Response.json({ error: "해석을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function postFlow(request: Request) {
  const json = await readJson(request);
  const sentences = cleanSentences(asRecord(json)?.sentences, 2, 80, 2000);
  if (!sentences) return Response.json({ error: "나눌 문장을 확인해 주세요." }, { status: 400 });
  try {
    const numbered = sentences.map((sentence, index) => `${index}. ${sentence}`).join("\n");
    const text = await askGemini(
      "당신은 영어 독해 본문을 의미 흐름에 따라 묶습니다. 원문의 줄바꿈이나 문단 나눔은 무시하고, 주제·주장·시간·목적이 바뀔 때만 새 구간을 시작하세요. 문장마다 자르지 마세요. 0부터 시작하는 문장 번호를 [시작, 끝] 포함 구간으로 이어서, 모든 문장을 빠짐없이 한 번씩만 덮는 JSON 배열만 출력하세요. 예: [[0,2],[3,5]]",
      numbered,
    );
    if (typeof text !== "string") return respond({ ...text, body: { error: "의미 흐름을 나누지 못했습니다. 잠시 후 다시 시도해 주세요." } });
    const groups = parseFlowGroups(text, sentences.length);
    if (!groups) return Response.json({ error: "의미 흐름을 문장 순서에 맞추지 못했습니다." }, { status: 502 });
    return Response.json({ groups });
  } catch (error) {
    console.error("Flow segmentation failed", error);
    return Response.json({ error: "의미 흐름을 나누지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function postFlowFeedback(request: Request) {
  const json = asRecord(await readJson(request));
  const text = typeof json?.text === "string" ? json.text.trim() : "";
  const summary = typeof json?.summary === "string" ? json.summary.trim() : "";
  if (!text || text.length > 8000 || !summary || summary.length > 2000) {
    return Response.json({ error: "비교할 내용이 없거나 너무 깁니다." }, { status: 400 });
  }
  try {
    const reply = await askGemini(
      "당신은 한국 고등학생의 영어 지문을 돕는 친근하고 전문적인 선생님입니다. 영어 흐름 블록의 핵심을 한국어 2~3문장으로 요약하고, 학생이 적은 한국어 핵심 생각과 비교합니다. 핵심을 잘 잡았으면 구체적으로 칭찬하고, 빠뜨린 중요한 내용이나 오해가 있으면 부드럽게 보완합니다. 학습 동기가 이어지도록 격려를 포함합니다. JSON만 출력합니다. 형식은 {\"summary\":\"AI 핵심 요약\",\"comparison\":\"비교 및 피드백\"} 입니다. 코드 블록이나 다른 설명은 넣지 않습니다.",
      `영어 지문:\n${text}\n\n학생 요약:\n${summary}`,
    );
    if (typeof reply !== "string") return respond(reply);
    const review = parseFlowFeedback(reply);
    if (!review) return Response.json({ error: "피드백을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    return Response.json(review);
  } catch (error) {
    console.error("Flow feedback failed", error);
    return Response.json({ error: "피드백을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

function parseQuizDraft(text: string, passage: string) {
  const parsed = parseJsonBlock(text);
  if (!Array.isArray(parsed)) return null;
  const lower = passage.toLowerCase();
  const items: { phrase: string; distractor: string }[] = [];
  const used: [number, number][] = [];
  for (const item of parsed) {
    const record = asRecord(item);
    const phrase = typeof record?.phrase === "string" ? record.phrase.trim() : "";
    const distractor = typeof record?.distractor === "string" ? record.distractor.trim() : "";
    if (!phrase || !distractor || phrase.length > 48 || distractor.length > 48) continue;
    if (phrase.toLowerCase() === distractor.toLowerCase()) continue;
    if (/[[\]/]/.test(phrase) || /[[\]/]/.test(distractor)) continue;
    const at = lower.indexOf(phrase.toLowerCase());
    if (at < 0) continue;
    const stop = at + phrase.length;
    if (used.some(([from, to]) => at < to && stop > from)) continue;
    used.push([at, stop]);
    items.push({ phrase, distractor });
    if (items.length === 8) break;
  }
  return items.length ? items : null;
}

export async function postQuizDraft(request: Request) {
  const json = asRecord(await readJson(request));
  const kind = json?.kind === "grammar" || json?.kind === "vocabulary" ? json.kind : "";
  const passage = typeof json?.passage === "string" ? json.passage.trim() : "";
  if (!kind || !passage || passage.length > 12000) {
    return Response.json({ error: "문제로 만들 본문을 확인해 주세요." }, { status: 400 });
  }
  const instruction = kind === "grammar"
    ? "당신은 한국 고등학교 영어 내신 어법 출제자입니다. 본문에서 수일치, 분사, 관계사, to부정사·동명사, 수동태, 접속사 중 실제로 드러나는 표현만 최대 8개 고르세요. phrase는 본문에 있는 연속 표현을 한 글자도 바꾸지 말고 그대로 복사합니다. distractor는 그 자리에서 학생이 틀리기 쉬운 다른 형태입니다. JSON 배열만 출력합니다. 예: [{\"phrase\":\"were led\",\"distractor\":\"led\"}]"
    : "당신은 한국 고등학교 영어 내신 어휘 출제자입니다. 본문에 실제로 있는 핵심 내용어를 최대 8개 고르세요. 기능어와 너무 쉬운 단어는 빼세요. phrase는 본문의 단어를 그대로 복사합니다. distractor는 문맥에는 안 맞지만 품사와 난이도가 비슷한 다른 영어 단어입니다. JSON 배열만 출력합니다. 예: [{\"phrase\":\"innovation\",\"distractor\":\"imitation\"}]";
  try {
    const text = await askGemini(instruction, passage);
    if (typeof text !== "string") return respond(text);
    const items = parseQuizDraft(text, passage);
    if (!items) return Response.json({ error: "본문에서 문제를 고르지 못했습니다." }, { status: 502 });
    return Response.json({ items });
  } catch (error) {
    console.error("Quiz draft failed", error);
    return Response.json({ error: "문제를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

function parseWrittenItems(text: string) {
  const parsed = parseJsonBlock(text);
  if (!Array.isArray(parsed)) return null;
  const items: { type: string; title: string; prompt: string; conditions: string[]; keywords: string[]; model: string }[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const record = asRecord(item);
    const type = typeof record?.type === "string" ? record.type.trim() : "";
    if (!WRITTEN_TYPES.has(type) || seen.has(type)) continue;
    const prompt = clipText(record?.prompt, 600);
    const modelAnswer = clipText(record?.model, 900);
    const conditions = clipList(record?.conditions, 5, 180);
    const keywords = clipList(record?.keywords, 8, 48);
    const title = clipText(record?.title, 40) || WRITTEN_TITLES[type];
    if (!prompt || !modelAnswer || modelAnswer.split(/\s+/).length < 4 || !conditions.length) continue;
    seen.add(type);
    items.push({ type, title, prompt, conditions, keywords, model: modelAnswer });
  }
  items.sort((a, b) => ["key", "condition", "summary"].indexOf(a.type) - ["key", "condition", "summary"].indexOf(b.type));
  return items.length >= 2 ? items : null;
}

export async function postWritten(request: Request) {
  const json = asRecord(await readJson(request));
  const passage = typeof json?.passage === "string" ? json.passage.trim() : "";
  if (!passage || passage.length > 12000) {
    return Response.json({ error: "문제로 만들 본문을 확인해 주세요." }, { status: 400 });
  }
  try {
    const text = await askGemini(
      "당신은 한국 고등학교 영어 내신 서술형 출제자입니다. 주어진 영어 본문만 근거로 문제를 만듭니다. type이 key, condition, summary인 문제 3개를 JSON 배열로만 출력합니다. key는 핵심 문장 영작입니다. 본문 내용을 한국어 지시로 묻고, 학생은 영어 한 문장으로 답합니다. condition은 조건 영작입니다. 반드시 넣을 영어 단어나 문법 조건을 conditions에 적습니다. summary는 내용 요약입니다. 본문 전체를 영어 두 문장 이내로 요약하게 합니다. model은 채점용 영어 모범 답안입니다. keywords는 채점에 쓸 핵심 표현입니다. 본문에 없는 사실을 만들지 않습니다. 형식은 [{\"type\":\"key\",\"title\":\"핵심 문장 영작\",\"prompt\":\"지시문\",\"conditions\":[\"조건\"],\"keywords\":[\"표현\"],\"model\":\"모범 답안\"}] 입니다. 코드 블록이나 다른 설명은 넣지 않습니다.",
      passage,
    );
    if (typeof text !== "string") return respond(text);
    const items = parseWrittenItems(text);
    if (!items) return Response.json({ error: "서술형 문제를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    return Response.json({ items });
  } catch (error) {
    console.error("Written quiz failed", error);
    return Response.json({ error: "서술형 문제를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function postWrittenFeedback(request: Request) {
  const json = asRecord(await readJson(request));
  const passage = clipText(json?.passage, 12000);
  const prompt = clipText(json?.prompt, 600);
  const modelAnswer = clipText(json?.model, 900);
  const answer = typeof json?.answer === "string" ? json.answer.trim() : "";
  const conditions = clipList(json?.conditions, 5, 180);
  const keywords = clipList(json?.keywords, 8, 48);
  if (!passage || !prompt || !modelAnswer || !answer || answer.length > 2000) {
    return Response.json({ error: "비교할 답안을 확인해 주세요." }, { status: 400 });
  }
  try {
    const text = await askGemini(
      "당신은 한국 고등학교 영어 서술형 채점 교사입니다. 학생 답안을 모범 답안과 비교해 의미, 문법, 핵심 키워드 포함 여부를 함께 봅니다. score는 0부터 100까지의 정수이며, 의미가 얼마나 일치하는지를 나타냅니다. 의미가 같고 문법만 약간 어색하면 70 이상, 핵심 내용이 빠지거나 본문과 어긋나면 그만큼 낮춥니다. 철자 한두 개 차이는 크게 깎지 않습니다. praise는 잘 쓴 부분을 구체적으로 칭찬하고, gap은 부족하거나 틀린 부분을 부드럽게 짚습니다. revision은 학생 답안의 뉘앙스를 살리면서 원어민 표현과 채점 기준에 맞게 다듬은 영어 문장입니다. 요약 문제면 revision도 두 문장 이내를 유지합니다. praise와 gap은 한국어로 씁니다. JSON만 출력합니다. 형식은 {\"score\":85,\"praise\":\"잘한 점\",\"gap\":\"부족한 점\",\"revision\":\"다듬은 영어 답안\"} 입니다.",
      `본문:\n${passage}\n\n문제:\n${prompt}\n\n조건:\n${conditions.join("\n") || "없음"}\n\n핵심 표현:\n${keywords.join(", ") || "없음"}\n\n모범 답안:\n${modelAnswer}\n\n학생 답안:\n${answer}`,
    );
    if (typeof text !== "string") return respond(text);
    const parsed = asRecord(parseJsonBlock(text));
    const score = Number(parsed?.score);
    const praise = clipText(parsed?.praise, 700);
    const gap = clipText(parsed?.gap, 700);
    const revision = clipText(parsed?.revision, 900);
    if (!Number.isFinite(score) || !praise || !gap || !revision) {
      return Response.json({ error: "피드백을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    }
    return Response.json({ score: Math.max(0, Math.min(100, Math.round(score))), praise, gap, revision });
  } catch (error) {
    console.error("Written review failed", error);
    return Response.json({ error: "답안을 분석하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function postWordLookup(request: Request) {
  const json = asRecord(await readJson(request));
  const word = typeof json?.word === "string" ? json.word.replace(/\s+/g, " ").trim() : "";
  const context = typeof json?.context === "string" ? json.context.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  if (!word || word.length > 80) return Response.json({ error: "뜻을 찾을 단어를 확인해 주세요." }, { status: 400 });
  try {
    const text = await askGemini(
      "당신은 한국 고등학생의 영어 단어장 선생님입니다. 주어진 영어 단어나 짧은 숙어의 품사, 한국어 뜻, 영어 유의어를 고르세요. JSON 객체만 출력합니다. 필드는 partOfSpeech, meaning, synonyms 입니다. partOfSpeech와 meaning은 한국어이고, meaning은 문맥에 맞는 짧은 뜻입니다. synonyms는 영어 유의어 배열이며 최대 4개, 없으면 빈 배열입니다. 영어 단어나 숙어가 아니면 meaning은 빈 문자열입니다.",
      `단어: ${word}\n문맥: ${context || "없음"}`,
    );
    if (typeof text !== "string") return respond(text);
    const parsed = asRecord(parseJsonBlock(text));
    const partOfSpeech = typeof parsed?.partOfSpeech === "string" ? parsed.partOfSpeech.trim().slice(0, 20) : "";
    const meaning = typeof parsed?.meaning === "string" ? parsed.meaning.trim().slice(0, 200) : "";
    const synonyms = Array.isArray(parsed?.synonyms)
      ? parsed.synonyms.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim().slice(0, 40)).slice(0, 4)
      : [];
    if (!meaning) return Response.json({ error: "이 표현의 뜻을 찾지 못했습니다." }, { status: 422 });
    return Response.json({ partOfSpeech, meaning, synonyms });
  } catch (error) {
    console.error("Word lookup failed", error);
    return Response.json({ error: "뜻을 찾지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function postVocabulary(request: Request) {
  const json = asRecord(await readJson(request));
  const passage = typeof json?.passage === "string" ? json.passage.trim() : "";
  if (!passage || passage.length > 12000) {
    return Response.json({ error: "단어로 만들 본문을 확인해 주세요." }, { status: 400 });
  }
  try {
    const text = await askGemini(
      "당신은 한국 고등학생의 영어 내신과 수능을 돕는 어휘 선생님입니다. 본문에 실제로 나온 핵심 어휘 8개를 원형으로 고르세요. 너무 쉬운 기능어는 빼세요. JSON 배열만 출력합니다. 각 항목은 word, partOfSpeech, meaning, synonyms 필드를 가집니다. partOfSpeech와 meaning은 한국어이고, meaning은 이 본문 문맥의 뜻입니다. synonyms는 영어 동의어 배열이며 없으면 빈 배열입니다.",
      passage,
    );
    if (typeof text !== "string") return respond(text);
    const parsed = parseJsonBlock(text);
    if (!Array.isArray(parsed)) return Response.json({ error: "핵심 단어를 충분히 고르지 못했습니다." }, { status: 502 });
    const words = [];
    for (const item of parsed) {
      const record = asRecord(item);
      const word = typeof record?.word === "string" ? record.word.trim() : "";
      const partOfSpeech = typeof record?.partOfSpeech === "string" ? record.partOfSpeech.trim() : "";
      const meaning = typeof record?.meaning === "string" ? record.meaning.trim() : "";
      if (!word || word.length > 80 || !partOfSpeech || !meaning || meaning.length > 200) continue;
      const synonyms = Array.isArray(record?.synonyms)
        ? record.synonyms.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()).slice(0, 4)
        : [];
      words.push({ word, partOfSpeech, meaning, synonyms });
      if (words.length === 10) break;
    }
    if (words.length < 5) return Response.json({ error: "핵심 단어를 충분히 고르지 못했습니다." }, { status: 502 });
    return Response.json({ words });
  } catch (error) {
    console.error("Vocabulary failed", error);
    return Response.json({ error: "단어를 고르지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
