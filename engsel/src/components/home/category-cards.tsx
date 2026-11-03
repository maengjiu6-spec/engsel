"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { writeActiveCategory } from "@/lib/study/active-category";
import { getDDay } from "@/lib/study/schedule";
import {
  parseCategoryStudies,
  readCategoryStudiesServerSnapshot,
  readCategoryStudiesSnapshot,
  subscribeCategoryStudies,
} from "@/lib/study/storage";
import { studyCategories } from "@/types/study";

export function CategoryCards() {
  const snapshot = useSyncExternalStore(
    subscribeCategoryStudies,
    readCategoryStudiesSnapshot,
    readCategoryStudiesServerSnapshot,
  );
  const studies = useMemo(() => parseCategoryStudies(snapshot), [snapshot]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const start = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(start);
  }, []);

  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label="학습 카테고리">
      {studyCategories.map((category) => {
        const study = studies.find((item) => item.categoryId === category.id);
        const dday = study?.examDate && now ? getDDay(study.examDate, now) : null;
        const progress = study?.progress ?? 0;

        return (
          <Link
            key={category.id}
            href={`/study/${category.id}`}
            onClick={() => writeActiveCategory(category.id)}
            className="flex min-h-64 flex-col justify-between rounded-3xl border border-stone-200 bg-white p-6 transition-colors hover:border-blue-900"
          >
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{category.label}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">{category.description}</p>
            </div>
            <div className="mt-8 flex items-end justify-between gap-4">
              <p className="text-3xl font-bold tracking-tight text-blue-900">
                {study?.examDate ? (dday?.label ?? "계산 중") : "시험일 미정"}
              </p>
              <p className="text-lg font-semibold text-stone-700">{progress}%</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
