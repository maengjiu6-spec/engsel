import { z } from "zod";
import type { Passage, StudyCategoryId } from "@/types/study";

const STORAGE_KEY = "engsel.passages";
const CHANGE_EVENT = "engsel-passages";
const categoryIds = ["textbook", "supplement", "mock-exam"] as const;

const passageSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  categoryId: z.enum(categoryIds).optional(),
});

export function subscribePassages(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function readPassagesSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readPassagesServerSnapshot() {
  return "";
}

export function parsePassages(snapshot: string): Passage[] {
  if (!snapshot) return [];
  try {
    const parsed = z.array(passageSchema).safeParse(JSON.parse(snapshot));
    if (!parsed.success) return [];
    return parsed.data.map((passage) => ({
      ...passage,
      categoryId: (passage.categoryId ?? "textbook") as StudyCategoryId,
    }));
  } catch {
    return [];
  }
}

export function writePassages(passages: Passage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passages));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
