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
