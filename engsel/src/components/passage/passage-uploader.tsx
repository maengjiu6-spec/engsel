"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  PASSAGE_IMAGE_ACCEPT,
  PASSAGE_IMAGE_MAX_BYTES,
  passageImageMediaType,
} from "@/lib/passage/image";
import {
  readActivePassageServerSnapshot,
  readActivePassageSnapshot,
  subscribeActivePassage,
  writeActivePassageId,
} from "@/lib/passage/selection";
import {
  parsePassages,
  readPassagesServerSnapshot,
  readPassagesSnapshot,
  subscribePassages,
  writePassages,
} from "@/lib/passage/storage";
import { studyCategories, type Passage, type StudyCategoryId } from "@/types/study";

type InputMode = "text" | "image";
type OcrState = "idle" | "loading" | "done" | "empty" | "error";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PassageUploader({
  initialCategoryId = "textbook",
}: {
  initialCategoryId?: StudyCategoryId;
}) {
  const router = useRouter();
  const titleId = useId();
  const textBodyId = useId();
  const imageBodyId = useId();
  const formRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);

  const [categoryId, setCategoryId] = useState<StudyCategoryId>(initialCategoryId);
  const [mode, setMode] = useState<InputMode>("text");
  const [title, setTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [imageBody, setImageBody] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");
  const [editingId, setEditingId] = useState<string | null>(null);
  const passagesSnapshot = useSyncExternalStore(
    subscribePassages,
    readPassagesSnapshot,
    readPassagesServerSnapshot,
  );
  const activeSnapshot = useSyncExternalStore(
    subscribeActivePassage,
    readActivePassageSnapshot,
    readActivePassageServerSnapshot,
  );
  const passages = useMemo(() => parsePassages(passagesSnapshot), [passagesSnapshot]);
  const groupedPassages = useMemo(
    () =>
      studyCategories
        .map((category) => ({
          category,
          items: passages.filter((passage) => passage.categoryId === category.id),
        }))
        .filter((group) => group.items.length > 0),
    [passages],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const activeBody = mode === "text" ? textBody : imageBody;
  const readingImage = mode === "image" && ocrState === "loading";
  const canSave = activeBody.trim().length > 0 && !readingImage;

  function showMessage(tone: "error" | "success" | "info", text: string) {
    setMessageTone(tone);
    setMessage(text);
  }

  function acceptFile(file: File) {
    const mediaType = passageImageMediaType(file);
    if (!mediaType) {
      showMessage("error", "PNG, JPG, WEBP, GIF 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > PASSAGE_IMAGE_MAX_BYTES) {
      showMessage("error", "이미지는 8MB 이하로 올려 주세요.");
      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const nextPreview = URL.createObjectURL(file);
    previewRef.current = nextPreview;
    setPreviewUrl(nextPreview);
    setImageName(file.name);
    setImageFile(file);
    void readImage(file);
  }

  async function readImage(file: File) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOcrState("loading");
    setImageBody("");
    showMessage("info", "이미지에서 영어 글자를 읽고 있습니다.");

    try {
      const text = await requestOcr(file, controller.signal);
      if (controller.signal.aborted) return;
      setImageBody(text);
      if (text) {
        setOcrState("done");
        showMessage("success", "글자를 읽었습니다. 틀린 부분을 고친 뒤 저장해 주세요.");
      } else {
        setOcrState("empty");
        showMessage("error", "글자를 찾지 못했습니다. 직접 입력하거나 다른 이미지를 올려 주세요.");
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setOcrState("error");
      showMessage(
        "error",
        error instanceof Error ? error.message : "이미지를 읽지 못했습니다.",
      );
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) acceptFile(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }

  function clearImage() {
    abortRef.current?.abort();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setImageName(null);
    setImageFile(null);
    setImageBody("");
    setOcrState("idle");
    setMessage(null);
  }

  function clearDraft() {
    abortRef.current?.abort();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setImageName(null);
    setImageFile(null);
    setImageBody("");
    setTextBody("");
    setTitle("");
    setOcrState("idle");
    setDragging(false);
    setMode("text");
    setEditingId(null);
    setMessage(null);
  }

  function startNewPassage() {
    clearDraft();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function savePassage() {
    const body = activeBody.trim();
    if (!body || readingImage) return;

    const nextTitle = title.trim() || defaultTitle(body);
    const editing = passages.find((item) => item.id === editingId);
    const passage: Passage = editing
      ? { ...editing, title: nextTitle, body, categoryId }
      : {
          id: crypto.randomUUID(),
          title: nextTitle,
          body,
          createdAt: new Date().toISOString(),
          categoryId,
        };
    const next = editing
      ? passages.map((item) => (item.id === passage.id ? passage : item))
      : [passage, ...passages];

    try {
      writePassages(next);
    } catch {
      showMessage("error", "이 브라우저에 본문을 저장하지 못했습니다.");
      return;
    }

    writeActivePassageId(passage.id);
    clearDraft();
    showMessage(
      "success",
      editing
        ? "본문을 수정했습니다. 다음 본문을 입력할 수 있습니다."
        : "본문을 저장했습니다. 다음 본문을 입력할 수 있습니다.",
    );
  }

  function editPassage(passage: Passage) {
    abortRef.current?.abort();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setImageName(null);
    setImageFile(null);
    setImageBody("");
    setOcrState("idle");
    setDragging(false);
    setMode("text");
    setCategoryId(passage.categoryId);
    setTitle(passage.title);
    setTextBody(passage.body);
    setEditingId(passage.id);
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function removePassage(id: string) {
    const next = passages.filter((item) => item.id !== id);
    try {
      writePassages(next);
    } catch {
      showMessage("error", "저장 목록을 바꾸지 못했습니다.");
      return;
    }
    if (activeSnapshot === id) writeActivePassageId(null);
    if (editingId === id) clearDraft();
  }

  function studyPassage(id: string) {
    writeActivePassageId(id);
    router.push("/quiz");
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section ref={formRef} className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-medium text-blue-900">{editingId ? "본문 수정" : "본문 등록"}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {editingId ? "저장한 본문 고치기" : "본문 업로드"}
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-stone-600">
          영어 본문을 붙여 넣거나, 교과서 사진을 올리면 글자를 읽어 옵니다. 내용을 확인한 뒤 저장하세요.
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-stone-100 p-1" role="tablist" aria-label="입력 방식">
          <TabButton active={mode === "text"} onClick={() => setMode("text")}>
            텍스트 직접 입력
          </TabButton>
          <TabButton active={mode === "image"} onClick={() => setMode("image")}>
            이미지 업로드
          </TabButton>
        </div>

        <label htmlFor="passage-category" className="mt-6 block text-sm font-medium text-stone-700">
          저장 위치
        </label>
        <select
          id="passage-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value as StudyCategoryId)}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-900"
        >
          {studyCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>

        <label htmlFor={titleId} className="mt-5 block text-sm font-medium text-stone-700">
          제목 <span className="font-normal text-stone-400">선택</span>
        </label>
        <input
          id={titleId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: Lesson 3 The Power of Words"
          className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-blue-900"
        />

        {mode === "text" ? (
          <div className="mt-5" role="tabpanel">
            <label htmlFor={textBodyId} className="block text-sm font-medium text-stone-700">
              영어 본문
            </label>
            <textarea
              id={textBodyId}
              lang="en"
              value={textBody}
              onChange={(event) => setTextBody(event.target.value)}
              placeholder="영어 본문을 붙여 넣으세요."
              className="mt-2 min-h-72 w-full resize-y rounded-2xl border border-stone-200 px-4 py-3 leading-7 outline-none focus:border-blue-900"
            />
          </div>
        ) : (
          <div className="mt-5" role="tabpanel">
            <label
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setDragging(false);
              }}
              onDrop={onDrop}
              className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center ${
                dragging ? "border-blue-900 bg-blue-50" : "border-stone-300 bg-stone-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={PASSAGE_IMAGE_ACCEPT}
                className="sr-only"
                onChange={onFileChange}
              />
              <span className="text-sm font-medium text-stone-800">
                이미지를 끌어다 놓거나 파일을 선택하세요
              </span>
              <span className="mt-1 text-sm text-stone-500">PNG, JPG, WEBP, GIF · 8MB 이하</span>
              <span className="mt-4 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800">
                파일 선택
              </span>
            </label>

            {previewUrl ? (
              <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-stone-200 p-3 sm:flex-row sm:items-start">
                {/* Blob preview from a local file. next/image does not load object URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={imageName ? `${imageName} 미리보기` : "올린 이미지 미리보기"}
                  className="max-h-48 w-full rounded-xl bg-stone-50 object-contain sm:w-40"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{imageName}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {ocrState === "loading" ? "글자를 읽는 중" : "인식 결과를 아래에서 고칠 수 있습니다."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => imageFile && void readImage(imageFile)}
                      disabled={!imageFile || ocrState === "loading"}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:cursor-not-allowed disabled:text-stone-400"
                    >
                      다시 읽기
                    </button>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                    >
                      이미지 지우기
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <label htmlFor={imageBodyId} className="mt-5 block text-sm font-medium text-stone-700">
              인식된 본문
            </label>
            <textarea
              id={imageBodyId}
              lang="en"
              value={imageBody}
              onChange={(event) => setImageBody(event.target.value)}
              disabled={ocrState === "loading"}
              placeholder={
                ocrState === "loading"
                  ? "글자를 읽는 중입니다."
                  : "이미지에서 읽은 글이 여기에 들어갑니다. 직접 고쳐도 됩니다."
              }
              className="mt-2 min-h-72 w-full resize-y rounded-2xl border border-stone-200 px-4 py-3 leading-7 outline-none focus:border-blue-900 disabled:bg-stone-50"
            />
          </div>
        )}

        {message ? (
          <p
            role="status"
            className={`mt-4 text-sm leading-6 ${
              messageTone === "error"
                ? "text-red-700"
                : messageTone === "success"
                  ? "text-blue-900"
                  : "text-stone-600"
            }`}
          >
            {message}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-stone-400">{activeBody.trim().length.toLocaleString("ko-KR")}자</p>
          <button
            type="button"
            onClick={savePassage}
            disabled={!canSave}
            className="rounded-full bg-blue-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {editingId ? "수정 내용 저장" : "본문 저장"}
          </button>
        </div>
      </section>

      <aside className="rounded-3xl border border-stone-200 bg-white p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <h2 className="text-lg font-semibold">저장된 본문</h2>
        <button
          type="button"
          onClick={startNewPassage}
          className="mt-4 w-full rounded-full bg-blue-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          + 새 본문 추가하기
        </button>
        {groupedPassages.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-stone-500">아직 저장된 본문이 없습니다.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-6">
            {groupedPassages.map(({ category, items }) => (
              <section key={category.id} aria-label={category.label}>
                <h3 className="text-sm font-semibold text-stone-500">
                  {category.label} · {items.length}개
                </h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {items.map((passage) => {
                    const selected = passage.id === activeSnapshot;
                    return (
                      <li
                        key={passage.id}
                        className={`rounded-2xl border p-4 ${
                          selected ? "border-blue-900 bg-blue-50" : "border-stone-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => writeActivePassageId(passage.id)}
                          aria-pressed={selected}
                          className="w-full text-left"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="font-medium text-stone-900">{passage.title}</span>
                            {selected ? (
                              <span className="shrink-0 text-xs font-medium text-blue-900">학습 중</span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs text-stone-400">
                            {dateFormat.format(new Date(passage.createdAt))}
                          </span>
                          <span className="mt-2 line-clamp-3 block text-sm leading-6 text-stone-600">
                            {passage.body}
                          </span>
                        </button>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => studyPassage(passage.id)}
                            className="rounded-full bg-blue-900 px-3 py-1.5 text-xs font-medium text-white"
                          >
                            선택/학습하기
                          </button>
                          <button
                            type="button"
                            onClick={() => editPassage(passage)}
                            className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => removePassage(passage.id)}
                            className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700"
                          >
                            삭제
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium ${
        active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
      }`}
    >
      {children}
    </button>
  );
}

function defaultTitle(body: string) {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return "제목 없는 본문";
  return line.length > 42 ? `${line.slice(0, 42)}…` : line;
}

async function requestOcr(file: File, signal: AbortSignal) {
  const form = new FormData();
  form.append("image", file);
  const response = await fetch("/api/passage/ocr", {
    method: "POST",
    body: form,
    signal,
  });

  let payload: { text?: unknown; error?: unknown } = {};
  try {
    payload = (await response.json()) as { text?: unknown; error?: unknown };
  } catch {
    throw new Error("이미지를 읽지 못했습니다.");
  }

  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "이미지를 읽지 못했습니다.",
    );
  }

  return typeof payload.text === "string" ? payload.text.trim() : "";
}
