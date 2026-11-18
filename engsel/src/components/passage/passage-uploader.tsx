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
import { readPassageImage, removePassageImage, savePassageImage } from "@/lib/passage/image-store";
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
  const [openBodyIds, setOpenBodyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [forgetImage, setForgetImage] = useState(false);
  const reviewKindRef = useRef<"upload" | "edit" | null>(null);
  const editTokenRef = useRef(0);
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

  const acceptFileRef = useRef<(file: File) => void>(() => {});

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "v" || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "file") target.blur();
    }

    function onPaste(event: ClipboardEvent) {
      const clipboard = event.clipboardData;
      const file = imageFileFromClipboard(clipboard);
      if (!file) return;
      const editingText = isTextEditingTarget(event.target);
      const text = (clipboard?.getData("text/plain") || "").trim();
      if (editingText && text && (clipboard?.files.length ?? 0) === 0) return;

      event.preventDefault();
      event.stopPropagation();
      if (event.target instanceof HTMLInputElement && event.target.type === "file") {
        event.target.blur();
      }
      deliverPastedImage(fileInputRef.current, namedPasteFile(file), () => {
        setMode("image");
      }, acceptFileRef.current);
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("paste", onPaste, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("paste", onPaste, true);
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
    setForgetImage(false);
    reviewKindRef.current = editingId ? "edit" : "upload";
    setReviewOpen(true);
    void readImage(file);
  }

  acceptFileRef.current = acceptFile;

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
    if (!editingId) setImageBody("");
    setOcrState("idle");
    setMessage(null);
    setReviewOpen(false);
    if (editingId) setForgetImage(true);
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
    setForgetImage(false);
    setReviewOpen(false);
    reviewKindRef.current = null;
    setMessage(null);
  }

  function startNewPassage() {
    clearDraft();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function savePassage() {
    const body = activeBody.trim();
    if (!body || readingImage) return;

    const nextTitle = title.trim() || defaultTitle(body);
    const editing = passages.find((item) => item.id === editingId);
    const id = editing?.id ?? crypto.randomUUID();
    let nextImageName = editing?.imageName;

    if (mode === "image") {
      if (imageFile && imageName && !forgetImage) {
        try {
          await savePassageImage(id, imageFile, imageName);
          nextImageName = imageName;
        } catch {
          showMessage("error", "이미지를 본문과 함께 저장하지 못했습니다.");
          return;
        }
      } else if (forgetImage || !imageName) {
        nextImageName = undefined;
        if (editing?.imageName) {
          try {
            await removePassageImage(id);
          } catch {
            showMessage("error", "저장해 둔 이미지를 지우지 못했습니다.");
            return;
          }
        }
      }
    }

    const passage: Passage = {
      id,
      title: nextTitle,
      body,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      categoryId,
      ...(nextImageName ? { imageName: nextImageName } : {}),
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

  function closeReview() {
    const kind = reviewKindRef.current;
    reviewKindRef.current = null;
    if (kind === "edit") clearDraft();
    else setReviewOpen(false);
  }

  async function editPassage(passage: Passage) {
    const token = editTokenRef.current + 1;
    editTokenRef.current = token;
    abortRef.current?.abort();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setImageName(null);
    setImageFile(null);
    setImageBody("");
    setOcrState("idle");
    setDragging(false);
    setForgetImage(false);
    setReviewOpen(false);
    setCategoryId(passage.categoryId);
    setTitle(passage.title);
    setTextBody(passage.body);
    setEditingId(passage.id);
    setMessage(null);

    if (passage.imageName) {
      try {
        const record = await readPassageImage(passage.id);
        if (editTokenRef.current !== token) return;
        if (record?.blob) {
          const name = record.name || passage.imageName;
          const file = new File([record.blob], name, { type: record.blob.type || "image/png" });
          const url = URL.createObjectURL(file);
          previewRef.current = url;
          setPreviewUrl(url);
          setImageName(name);
          setImageFile(file);
          setImageBody(passage.body);
          setMode("image");
          setOcrState(passage.body.trim() ? "done" : "empty");
          reviewKindRef.current = "edit";
          setReviewOpen(true);
          return;
        }
      } catch {
        if (editTokenRef.current !== token) return;
        showMessage("error", "저장해 둔 원본 이미지를 열지 못했습니다. 텍스트만 고칠 수 있습니다.");
      }
    }

    if (editTokenRef.current !== token) return;
    reviewKindRef.current = null;
    setMode("text");
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

  function togglePassageBody(id: string) {
    setOpenBodyIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openReview() {
    reviewKindRef.current = editingId ? "edit" : "upload";
    setReviewOpen(true);
  }

  const showingReview = reviewOpen && Boolean(previewUrl);

  return (
    <>
    <div
      inert={showingReview ? true : undefined}
      className="grid items-start gap-8 min-[960px]:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <section ref={formRef} className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {editingId ? "저장한 본문 고치기" : "본문 업로드"}
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-stone-600">
          영어 본문을 붙여 넣거나, 교과서 사진을 올리면 글자를 읽어 옵니다. 클립보드에 이미지가 있으면 화면 어디에서나 Ctrl+V로 바로 올릴 수 있습니다.
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
                이미지를 끌어다 놓거나, 파일을 고르거나, Ctrl+V로 붙여 넣으세요
              </span>
              <span className="mt-1 text-sm text-stone-500">PNG, JPG, WEBP, GIF · 8MB 이하</span>
              <span className="mt-4 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800">
                파일 선택
              </span>
            </label>

            {previewUrl ? (
              <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-stone-200 p-3 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={openReview}
                  className="w-full rounded-xl sm:w-40"
                >
                  {/* Blob preview from a local file. next/image does not load object URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={imageName ? `${imageName} 미리보기` : "올린 이미지 미리보기"}
                    className="max-h-48 w-full rounded-xl bg-stone-50 object-contain"
                  />
                  <span className="sr-only">이미지를 크게 보고 본문 고치기</span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{imageName}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {ocrState === "loading" ? "글자를 읽는 중" : "이미지를 누르면 왼쪽 원본과 오른쪽 수정 칸이 열립니다."}
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
            onClick={() => void savePassage()}
            disabled={!canSave}
            className="rounded-full bg-blue-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {editingId ? "수정 내용 저장" : "본문 저장"}
          </button>
        </div>
      </section>

      <aside className="rounded-3xl border border-stone-200 bg-white p-6 min-[960px]:sticky min-[960px]:top-6 min-[960px]:max-h-[calc(100vh-3rem)] min-[960px]:overflow-y-auto">
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
                    const bodyOpen = openBodyIds.has(passage.id);
                    const bodyId = `saved-passage-body-${passage.id}`;
                    const hasBody = passage.body.trim().length > 0;
                    return (
                      <li
                        key={passage.id}
                        className={`rounded-2xl border p-4 ${
                          selected ? "border-blue-900 bg-blue-50" : "border-stone-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => writeActivePassageId(passage.id)}
                            aria-pressed={selected}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block break-words font-medium text-stone-900">{passage.title}</span>
                            <span className="mt-1 block text-xs text-stone-400">
                              {dateFormat.format(new Date(passage.createdAt))}
                            </span>
                          </button>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            {selected ? (
                              <span className="text-xs font-medium text-blue-900">학습 중</span>
                            ) : null}
                            {hasBody ? (
                              <button
                                type="button"
                                aria-expanded={bodyOpen}
                                aria-controls={bodyId}
                                onClick={() => togglePassageBody(passage.id)}
                                className="text-xs font-medium text-stone-500 hover:text-blue-900"
                              >
                                {bodyOpen ? "접기" : "본문 보기"}
                              </button>
                            ) : null}
                          </span>
                        </div>
                        {hasBody && bodyOpen ? (
                          <p
                            id={bodyId}
                            lang="en"
                            className="mt-3 max-h-40 overflow-y-auto pr-1 text-sm leading-6 text-stone-600"
                          >
                            {passage.body}
                          </p>
                        ) : null}
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
                            onClick={() => void editPassage(passage)}
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
    {showingReview && previewUrl ? (
      <div className="fixed inset-0 z-50 grid grid-rows-[minmax(0,1fr)] bg-stone-900/45 p-3" role="dialog" aria-modal="true" aria-labelledby="image-review-heading">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
            <div className="min-w-0">
              <p id="image-review-heading" className="font-bold">이미지를 보며 고치기</p>
              <p className="truncate text-sm text-stone-500">{imageName || "이미지"}</p>
            </div>
            <button type="button" onClick={closeReview} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700">
              닫기
            </button>
          </div>
          <div className="grid min-h-0 min-[720px]:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] max-[719px]:grid-rows-[minmax(10rem,38vh)_minmax(0,1fr)]">
            <div className="min-h-0 min-w-0 overflow-auto bg-stone-50 p-4">
              {/* Blob preview from a local file. next/image does not load object URLs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={imageName ? `${imageName} 원본` : "업로드한 원본 이미지"}
                className="h-auto w-full rounded-xl bg-white"
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-auto border-t border-stone-200 p-4 min-[720px]:border-t-0 min-[720px]:border-l">
              <label htmlFor="image-review-category" className="block text-sm font-medium text-stone-700">
                저장 위치
              </label>
              <select
                id="image-review-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value as StudyCategoryId)}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-900"
              >
                {studyCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
              <label htmlFor="image-review-title" className="block text-sm font-medium text-stone-700">
                제목 <span className="font-normal text-stone-400">선택</span>
              </label>
              <input
                id="image-review-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: Lesson 3 The Power of Words"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-blue-900"
              />
              <label htmlFor="image-review-body" className="block text-sm font-medium text-stone-700">
                인식된 본문
              </label>
              <textarea
                id="image-review-body"
                lang="en"
                value={imageBody}
                onChange={(event) => setImageBody(event.target.value)}
                disabled={ocrState === "loading"}
                placeholder={ocrState === "loading" ? "글자를 읽는 중입니다." : "이미지에서 읽은 글이 여기에 들어갑니다. 직접 고쳐도 됩니다."}
                className="min-h-48 w-full flex-1 resize-none rounded-2xl border border-stone-200 px-4 py-3 leading-7 outline-none focus:border-blue-900 disabled:bg-stone-50"
              />
              {message ? (
                <p
                  role="status"
                  className={`text-sm leading-6 ${
                    messageTone === "error" ? "text-red-700" : messageTone === "success" ? "text-blue-900" : "text-stone-600"
                  }`}
                >
                  {message}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-stone-400">{imageBody.trim().length.toLocaleString("ko-KR")}자</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => imageFile && void readImage(imageFile)}
                    disabled={!imageFile || ocrState === "loading"}
                    className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:cursor-not-allowed disabled:text-stone-400"
                  >
                    다시 읽기
                  </button>
                  <button type="button" onClick={clearImage} className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700">
                    이미지 지우기
                  </button>
                  <button
                    type="button"
                    onClick={() => void savePassage()}
                    disabled={!canSave}
                    className="rounded-full bg-blue-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {editingId ? "수정 내용 저장" : "본문 저장"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
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

function imageFileFromClipboard(data: DataTransfer | null) {
  if (!data) return null;
  const pasted = [...data.files].find((file) => file.type.startsWith("image/"));
  if (pasted) return pasted;
  for (const item of data.items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

function namedPasteFile(file: File) {
  let type = (file.type || "image/png").toLowerCase();
  if (type === "image/jpg") type = "image/jpeg";
  const generic = !file.name || file.name === "image.png" || file.name.startsWith("blob");
  const ext = type === "image/jpeg" ? "jpg" : type.split("/")[1] || "png";
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const name = generic
    ? `붙여넣은 이미지 ${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${ext}`
    : file.name;
  return new File([file], name, { type });
}

function isTextEditingTarget(target: EventTarget | null) {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return target.type !== "file";
  return target instanceof HTMLElement && target.isContentEditable;
}

function deliverPastedImage(
  input: HTMLInputElement | null,
  file: File,
  showImageMode: () => void,
  acceptFile: (file: File) => void,
) {
  showImageMode();
  if (!input) {
    acceptFile(file);
    return;
  }
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
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
