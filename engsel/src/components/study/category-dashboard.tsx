"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatCountdown, getDDay } from "@/lib/study/schedule";
import {
  parseCategoryStudies,
  readCategoryStudiesServerSnapshot,
  readCategoryStudiesSnapshot,
  subscribeCategoryStudies,
  writeCategoryStudy,
} from "@/lib/study/storage";
import { studyCategories, type StudyCategoryId } from "@/types/study";

export function CategoryDashboard({ categoryId }: { categoryId: StudyCategoryId }) {
  const category = studyCategories.find((item) => item.id === categoryId);
  const studySnapshot = useSyncExternalStore(
    subscribeCategoryStudies,
    readCategoryStudiesSnapshot,
    readCategoryStudiesServerSnapshot,
  );
  const studies = useMemo(() => parseCategoryStudies(studySnapshot), [studySnapshot]);
  const study = studies.find((item) => item.categoryId === categoryId);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const start = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, []);

  if (!category || !study) return null;

  const currentStudy = study;
  const dday = currentStudy.examDate && now ? getDDay(currentStudy.examDate, now) : null;
  const countdown = currentStudy.examDate && now ? formatCountdown(currentStudy.examDate, now) : null;

  const updateExamDate = (examDate: string | null) => {
    try {
      writeCategoryStudy({ ...currentStudy, examDate });
    } catch {
      return;
    }
  };

  const updateNote = (note: string) => {
    try {
      writeCategoryStudy({ ...currentStudy, note });
    } catch {
      return;
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/" className="text-sm font-medium text-blue-900">
          전체 카테고리
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{category.label}</h1>
        <p className="mt-2 text-stone-600">{category.description}</p>
      </div>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-stone-500">시험 D-Day</p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-blue-900">
              {dday?.label ?? "시험일 미정"}
            </p>
            <p className="mt-2 text-sm text-stone-600" aria-live="polite">
              {countdown ?? "시험일을 정하면 남은 시간이 표시됩니다."}
            </p>
          </div>
          <label className="text-sm font-medium text-stone-700">
            시험일
            <input
              type="date"
              value={currentStudy.examDate ?? ""}
              onChange={(event) => updateExamDate(event.target.value || null)}
              className="mt-2 block rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-blue-900"
            />
          </label>
        </div>
        <div className="mt-8">
          <div className="flex items-center justify-between text-sm">
            <p className="font-medium text-stone-700">학습 달성도</p>
            <p className="font-semibold text-stone-900">{currentStudy.progress}%</p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={currentStudy.progress}
            aria-label="학습 달성도"
          >
            <div className="h-full rounded-full bg-blue-900" style={{ width: `${currentStudy.progress}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <label className="block text-sm font-medium text-stone-700" htmlFor="category-note">
          나를 위한 한마디
        </label>
        <textarea
          id="category-note"
          value={currentStudy.note}
          onChange={(event) => updateNote(event.target.value)}
          rows={5}
          placeholder="오늘 나에게 남기고 싶은 말을 적어 보세요."
          className="mt-3 w-full resize-y rounded-2xl border border-stone-200 px-4 py-3 text-base leading-7 text-stone-900 outline-none placeholder:text-stone-400 focus:border-blue-900"
        />
      </section>
    </main>
  );
}
