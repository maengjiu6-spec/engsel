"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  categoryFromPath,
  clearActiveCategory,
  isLearningPath,
  readActiveCategoryServerSnapshot,
  readActiveCategorySnapshot,
  showCategoryNotice,
  subscribeActiveCategory,
  writeActiveCategory,
} from "@/lib/study/active-category";
import { isStudyCategoryId } from "@/lib/study/storage";

export function CategoryAccess({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);
  const storedCategory = useSyncExternalStore(
    subscribeActiveCategory,
    readActiveCategorySnapshot,
    readActiveCategoryServerSnapshot,
  );
  const pathCategory = categoryFromPath(pathname);
  const locked = isLearningPath(pathname) && !pathCategory && !isStudyCategoryId(storedCategory);

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

  if (locked) return null;

  return children;
}
