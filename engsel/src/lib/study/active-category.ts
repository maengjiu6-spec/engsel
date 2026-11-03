import { isStudyCategoryId } from "@/lib/study/storage";
import type { StudyCategoryId } from "@/types/study";

const STORAGE_KEY = "engsel.active-category";
const CHANGE_EVENT = "engsel-active-category";
const TOAST_EVENT = "engsel-category-toast";
const CATEGORY_NOTICE = "먼저 공부할 카테고리(교과서/부교재/모의고사)를 선택해주세요";

const learningPaths = [
  "/passage",
  "/notes",
  "/quiz",
  "/rewrite",
  "/plan",
  "/analytics",
  "/assistant",
];

let toastMessage = "";
let toastTimer = 0;

export function subscribeActiveCategory(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function readActiveCategorySnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readActiveCategoryServerSnapshot() {
  return "";
}

export function writeActiveCategory(categoryId: StudyCategoryId) {
  localStorage.setItem(STORAGE_KEY, categoryId);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearActiveCategory() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function categoryFromPath(pathname: string): StudyCategoryId | null {
  const id = pathname.match(/^\/study\/([^/]+)/)?.[1];
  return isStudyCategoryId(id) ? id : null;
}

export function isLearningPath(pathname: string) {
  return learningPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function subscribeCategoryNotice(onStoreChange: () => void) {
  window.addEventListener(TOAST_EVENT, onStoreChange);
  return () => window.removeEventListener(TOAST_EVENT, onStoreChange);
}

export function readCategoryNoticeSnapshot() {
  return toastMessage;
}

export function readCategoryNoticeServerSnapshot() {
  return "";
}

export function showCategoryNotice() {
  toastMessage = CATEGORY_NOTICE;
  window.dispatchEvent(new Event(TOAST_EVENT));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage = "";
    window.dispatchEvent(new Event(TOAST_EVENT));
  }, 3200);
}
