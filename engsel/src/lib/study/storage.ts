import { z } from "zod";
import type { CategoryStudy, StudyCategoryId } from "@/types/study";

const STORAGE_KEY = "engsel.category-studies";
const CHANGE_EVENT = "engsel-category-studies";
const categoryIds = ["textbook", "supplement", "mock-exam"] as const satisfies readonly StudyCategoryId[];

const categoryStudySchema = z.object({
  categoryId: z.enum(["textbook", "supplement", "mock-exam"]),
  examDate: z.string().nullable(),
  progress: z.number().min(0).max(100),
  note: z.string().default(""),
});

export function subscribeCategoryStudies(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function readCategoryStudiesSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readCategoryStudiesServerSnapshot() {
  return "";
}

export function parseCategoryStudies(snapshot: string): CategoryStudy[] {
  const stored = new Map<StudyCategoryId, CategoryStudy>();
  if (snapshot) {
    try {
      const parsed = z.array(categoryStudySchema).safeParse(JSON.parse(snapshot));
      if (parsed.success) {
        for (const study of parsed.data) stored.set(study.categoryId, study);
      }
    } catch {
      stored.clear();
    }
  }

  return categoryIds.map(
    (categoryId) =>
      stored.get(categoryId) ?? {
        categoryId,
        examDate: null,
        progress: 0,
        note: "",
      },
  );
}

export function writeCategoryStudy(study: CategoryStudy) {
  const current = parseCategoryStudies(readCategoryStudiesSnapshot());
  const next = current.map((item) => (item.categoryId === study.categoryId ? study : item));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isStudyCategoryId(value: string | undefined): value is StudyCategoryId {
  return categoryIds.some((categoryId) => categoryId === value);
}
