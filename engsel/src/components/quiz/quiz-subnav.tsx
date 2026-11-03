"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { quizTabs } from "@/lib/quiz/tabs";

export function QuizSubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="문제 풀이 메뉴">
      {quizTabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active
                ? "bg-blue-900 text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
