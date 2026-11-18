async function draftQuizItems(kind, passage) {
  const response = await fetch("/api/quiz-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, passage }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(payload.items)) {
    throw new Error(payload.error || "문제를 만들지 못했습니다.");
  }
  return payload.items;
}

async function draftWrittenItems(passage) {
  const response = await fetch("/api/written", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passage }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(payload.items)) {
    throw new Error(payload.error || "서술형 문제를 만들지 못했습니다.");
  }
  return payload.items;
}

async function reviewWrittenAnswer(input) {
  const response = await fetch("/api/written-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !Number.isInteger(payload.score)) {
    throw new Error(payload.error || "답안을 분석하지 못했습니다.");
  }
  return payload;
}

async function lookupWordEntry(word, context) {
  const response = await fetch("/api/word-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, context: context || "" }),
  });
  const payload = await response.json().catch(() => ({}));
  const meaning = typeof payload.meaning === "string" ? payload.meaning.trim() : "";
  if (!response.ok || !meaning) {
    throw new Error(payload.error || "뜻을 찾지 못했습니다.");
  }
  return {
    partOfSpeech: typeof payload.partOfSpeech === "string" ? payload.partOfSpeech.trim() : "",
    meaning,
    synonyms: Array.isArray(payload.synonyms) ? payload.synonyms.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()) : [],
  };
}

async function extractKeyVocabulary(passage) {
  const response = await fetch("/api/vocabulary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passage }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(payload.words)) {
    throw new Error(payload.error || "핵심 단어를 불러오지 못했습니다.");
  }
  return payload.words;
}
