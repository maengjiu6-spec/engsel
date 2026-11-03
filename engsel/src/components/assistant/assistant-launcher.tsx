"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  parsePassages,
  readPassagesServerSnapshot,
  readPassagesSnapshot,
  subscribePassages,
} from "@/lib/passage/storage";
import {
  readActivePassageServerSnapshot,
  readActivePassageSnapshot,
  subscribeActivePassage,
} from "@/lib/passage/selection";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AssistantLauncher() {
  const pathname = usePathname();
  const hidden = pathname === "/" || pathname.startsWith("/study/");
  const panelId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const passageSnapshot = useSyncExternalStore(
    subscribePassages,
    readPassagesSnapshot,
    readPassagesServerSnapshot,
  );
  const activePassageId = useSyncExternalStore(
    subscribeActivePassage,
    readActivePassageSnapshot,
    readActivePassageServerSnapshot,
  );
  const passage = useMemo(
    () => parsePassages(passageSnapshot).find((item) => item.id === activePassageId) ?? null,
    [passageSnapshot, activePassageId],
  );

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages, pending, error]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (hidden) return null;

  const ask = async () => {
    const content = draft.trim();
    if (!content || pending) return;

    const nextMessages = [...messages, { role: "user" as const, content }].slice(-20);
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          passage: passage ? { title: passage.title, body: passage.body } : null,
        }),
      });
      const payload = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !payload.text) {
        setError(payload.error || "도우미가 답을 하지 못했습니다.");
        return;
      }
      setMessages((current) => [...current, { role: "assistant", content: payload.text ?? "" }].slice(-20));
    } catch {
      setError("도우미에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label="AI 도우미"
          className="flex h-96 w-[min(20rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg"
        >
          <header className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
            <p className="text-sm font-bold">AI 도우미</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            >
              닫기
            </button>
          </header>
          <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="text-sm leading-6 text-stone-500">공부하다가 궁금한 점을 물어보세요.</p>
            ) : (
              messages.map((message, index) => (
                <p
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "ml-8 rounded-2xl bg-blue-900 px-3 py-2 text-sm leading-6 text-white"
                      : "mr-6 whitespace-pre-wrap rounded-2xl bg-stone-100 px-3 py-2 text-sm leading-6 text-stone-800"
                  }
                >
                  {message.content}
                </p>
              ))
            )}
            {pending ? <p className="text-xs text-stone-400">답을 준비하고 있습니다.</p> : null}
            {error ? <p className="text-xs leading-5 text-red-700">{error}</p> : null}
          </div>
          <form
            className="flex items-end gap-2 border-t border-stone-200 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void ask();
            }}
          >
            <label className="sr-only" htmlFor={`${panelId}-question`}>
              질문
            </label>
            <textarea
              id={`${panelId}-question`}
              value={draft}
              rows={2}
              placeholder="질문을 적어 보세요."
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask();
                }
              }}
              className="max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-blue-900"
            />
            <button
              type="submit"
              disabled={pending || draft.trim().length === 0}
              className="rounded-full bg-blue-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              보내기
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="h-10 rounded-full bg-blue-900 px-3 text-xs font-bold text-white shadow-md hover:bg-blue-950"
      >
        AI
      </button>
    </div>
  );
}
