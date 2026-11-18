import { z } from "zod";
import type { LearningPlan, PlanTask, PlanVolume, StudyCategoryId } from "@/types/study";

const STORAGE_KEY = "engsel.study-plan";
const CHANGE_EVENT = "engsel-study-plan";
const categoryIds = ["textbook", "supplement", "mock-exam"] as const satisfies readonly StudyCategoryId[];

const volumeSchema = z.object({
  categoryId: z.enum(categoryIds),
  total: z.number(),
  completed: z.number(),
});

const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  done: z.boolean(),
  createdOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.enum(categoryIds).optional(),
  kind: z.enum(["study", "review"]).optional(),
  href: z.string().optional(),
  auto: z.boolean().optional(),
  sourceId: z.string().nullable().optional(),
  reviewStep: z.number().optional(),
});

const planSchema = z.object({
  examLabel: z.string().optional(),
  examDate: z.string().nullable().optional(),
  volumes: z.array(volumeSchema).optional(),
  weekdays: z.array(z.number()).optional(),
  tasks: z.array(taskSchema).optional(),
});

function wholeNumber(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function volumePercent(volume: PlanVolume) {
  if (volume.total <= 0) return 0;
  const completed = Math.min(volume.completed, volume.total);
  return Math.round((completed / volume.total) * 100);
}

function normalizeVolumes(volumes: PlanVolume[]) {
  const stored = new Map(volumes.map((volume) => [volume.categoryId, volume]));
  return categoryIds.map((categoryId) => {
    const volume = stored.get(categoryId);
    const total = wholeNumber(volume?.total ?? 0);
    const completed = Math.min(total, wholeNumber(volume?.completed ?? 0));
    return { categoryId, total, completed };
  });
}

function studyHref(href: string | undefined, categoryId: StudyCategoryId) {
  if (href && /^\/(study|quiz|notes|passage|rewrite)(\/|$)/.test(href)) return href;
  return `/study/${categoryId}`;
}

function normalizeWeekdays(days: number[] | undefined) {
  const picked = [...new Set((days ?? [1, 2, 3, 4, 5]).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  picked.sort((left, right) => left - right);
  return picked.length > 0 ? picked : [1, 2, 3, 4, 5];
}

function normalizeTasks(tasks: PlanTask[]) {
  return tasks
    .map((task) => {
      const categoryId = categoryIds.includes(task.categoryId) ? task.categoryId : "textbook";
      return {
        ...task,
        title: task.title.trim().slice(0, 80),
        categoryId,
        kind: task.kind === "review" ? "review" : "study",
        href: studyHref(task.href, categoryId),
        auto: task.auto === true,
        sourceId: task.sourceId || null,
        reviewStep: Number.isFinite(task.reviewStep) ? Math.max(0, Math.round(task.reviewStep)) : 0,
      } satisfies PlanTask;
    })
    .filter((task) => task.title.length > 0);
}

export function emptyLearningPlan(): LearningPlan {
  return {
    examLabel: "수능",
    examDate: null,
    volumes: normalizeVolumes([]),
    weekdays: [1, 2, 3, 4, 5],
    tasks: [],
  };
}

function normalizePlan(plan: LearningPlan): LearningPlan {
  const examDate = plan.examDate && /^\d{4}-\d{2}-\d{2}$/.test(plan.examDate) ? plan.examDate : null;
  return {
    examLabel: plan.examLabel.trim().slice(0, 40) || "수능",
    examDate,
    volumes: normalizeVolumes(plan.volumes),
    weekdays: normalizeWeekdays(plan.weekdays),
    tasks: normalizeTasks(plan.tasks),
  };
}

export function subscribeLearningPlan(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function readLearningPlanSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readLearningPlanServerSnapshot() {
  return "";
}

export function parseLearningPlan(snapshot: string): LearningPlan {
  if (!snapshot) return emptyLearningPlan();
  try {
    const parsed = planSchema.safeParse(JSON.parse(snapshot));
    if (!parsed.success) return emptyLearningPlan();
    return normalizePlan({
      examLabel: parsed.data.examLabel ?? "수능",
      examDate: parsed.data.examDate ?? null,
      volumes: parsed.data.volumes ?? [],
      weekdays: parsed.data.weekdays ?? [1, 2, 3, 4, 5],
      tasks: (parsed.data.tasks ?? []) as PlanTask[],
    });
  } catch {
    return emptyLearningPlan();
  }
}

export function writeLearningPlan(plan: LearningPlan) {
  const next = normalizePlan(plan);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return next;
}
