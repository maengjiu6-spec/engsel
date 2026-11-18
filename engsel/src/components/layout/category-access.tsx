"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  categoryFromPath,
  clearActiveCategory,
  isLearningPath,
  readActiveCategorySnapshot,
  showCategoryNotice,
  writeActiveCategory,
} from "@/lib/study/active-category";
import { isStudyCategoryId } from "@/lib/study/storage";

export function CategoryAccess({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);
  const pathCategory = categoryFromPath(pathname);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (pathname === "/") {
      if (readActiveCategorySnapshot()) clearActiveCategory();
      return;
    }

    if (pathCategory) {
      writeActiveCategory(pathCategory);
      return;
    }

    if (isLearningPath(pathname) && !isStudyCategoryId(readActiveCategorySnapshot() || undefined)) {
      showCategoryNotice();
      routerRef.current.replace("/");
    }
  }, [pathname, pathCategory]);

  return children;
}
