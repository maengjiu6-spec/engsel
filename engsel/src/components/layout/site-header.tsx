"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { features } from "@/lib/features";
import {
  categoryFromPath,
  readActiveCategoryServerSnapshot,
  readActiveCategorySnapshot,
  readCategoryNoticeServerSnapshot,
  readCategoryNoticeSnapshot,
  showCategoryNotice,
  subscribeActiveCategory,
  subscribeCategoryNotice,
} from "@/lib/study/active-category";
import { isStudyCategoryId } from "@/lib/study/storage";
import { studyCategories } from "@/types/study";

export function SiteHeader() {
  const pathname = usePathname();
  const storedCategory = useSyncExternalStore(
    subscribeActiveCategory,
    readActiveCategorySnapshot,
    readActiveCategoryServerSnapshot,
  );
  const notice = useSyncExternalStore(
    subscribeCategoryNotice,
    readCategoryNoticeSnapshot,
    readCategoryNoticeServerSnapshot,
  );
  const pathCategory = categoryFromPath(pathname);
  const categoryId =
    pathname === "/" ? null : pathCategory ?? (isStudyCategoryId(storedCategory) ? storedCategory : null);
  const category = studyCategories.find((item) => item.id === categoryId);
  const unlocked = category != null;

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
          <Link href="/" className="text-stone-900">
            EngSel 엥셀
          </Link>
          {category ? (
            <>
              <span className="font-normal text-stone-400" aria-hidden="true">
                ›
              </span>
              <Link href={`/study/${category.id}`} className="text-blue-900" aria-current={pathCategory ? "page" : undefined}>
                [{category.label}]
              </Link>
            </>
          ) : null}
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="주요 메뉴">
          <Link href="/" className={pathname === "/" ? "font-medium text-stone-900" : "text-stone-600 hover:text-stone-900"}>
            홈
          </Link>
          {features.map((feature) => {
            const active = pathname === feature.href || pathname.startsWith(`${feature.href}/`);
            const href = feature.href === "/passage" && categoryId ? `/passage?category=${categoryId}` : feature.href;
            if (!unlocked) {
              return (
                <button
                  key={feature.href}
                  type="button"
                  aria-disabled="true"
                  onClick={showCategoryNotice}
                  className="cursor-not-allowed text-stone-300"
                >
                  {feature.title}
                </button>
              );
            }

            return (
              <Link
                key={feature.href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={active ? "font-medium text-stone-900" : "text-stone-600 hover:text-stone-900"}
              >
                {feature.title}
              </Link>
            );
          })}
        </nav>
      </div>
      {notice ? (
        <p
          role="status"
          className="fixed bottom-6 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-stone-900 px-4 py-3 text-center text-sm text-white shadow-lg"
        >
          {notice}
        </p>
      ) : null}
    </header>
  );
}
