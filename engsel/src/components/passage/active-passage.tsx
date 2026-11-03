"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
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
import { studyCategories } from "@/types/study";

export function ActivePassage() {
  const passageSnapshot = useSyncExternalStore(
    subscribePassages,
    readPassagesSnapshot,
    readPassagesServerSnapshot,
  );
  const activeSnapshot = useSyncExternalStore(
    subscribeActivePassage,
    readActivePassageSnapshot,
    readActivePassageServerSnapshot,
  );
  const passage = useMemo(
    () => parsePassages(passageSnapshot).find((item) => item.id === activeSnapshot) ?? null,
    [passageSnapshot, activeSnapshot],
  );
  const category = studyCategories.find((item) => item.id === passage?.categoryId);

  if (!passage) {
    return (
      <section className="rounded-3xl border border-dashed border-stone-300 bg-white p-6">
        <p className="text-sm font-medium text-stone-500">현재 본문</p>
        <p className="mt-2 leading-7 text-stone-600">
          학습할 본문이 아직 선택되지 않았습니다. 본문 목록에서 공부할 글을 고르면 이 화면에 내용이 따라옵니다.
        </p>
        <Link href="/passage" className="mt-4 inline-block text-sm font-medium text-blue-900">
          본문 선택하기
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-blue-900">현재 본문</p>
        <p className="text-sm text-stone-500">{category?.label}</p>
      </div>
      <h2 className="mt-2 text-xl font-bold tracking-tight">{passage.title}</h2>
      <p className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap leading-7 text-stone-700">{passage.body}</p>
    </section>
  );
}
