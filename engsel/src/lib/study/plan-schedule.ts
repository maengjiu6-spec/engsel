import { parseLocalDate, toDateInputValue } from "@/lib/study/schedule";
import type { PlanTask, StudyCategoryId } from "@/types/study";

export const REVIEW_INTERVALS = [1, 3, 7, 14];

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayLabel(day: number) {
  return WEEKDAY_LABELS[day] ?? "";
}

export function addDays(value: string, days: number) {
  const date = parseLocalDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function weekDates(anchor: string) {
  const date = parseLocalDate(anchor);
  if (!date) return [];
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toDateInputValue(day);
  });
}

export function dayStatus(date: string, tasks: PlanTask[], today: string) {
  const planned = tasks.filter((task) => task.createdOn === date && task.kind === "study");
  if (planned.length === 0) return "empty" as const;
  if (planned.every((task) => task.done)) return "done" as const;
  if (date < today) return "missed" as const;
  if (planned.some((task) => task.done) || date === today) return "active" as const;
  return "planned" as const;
}

export function parseUnitInput(input: string): { units: string[] } | { error: string } {
  const tokens = input
    .split(/[,，\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return { error: "학습 범위를 입력해 주세요." };

  const units: string[] = [];
  for (const token of tokens) {
    const range = /^(\d+)\s*[-~]\s*(\d+)$/.exec(token);
    if (range) {
      const low = Math.min(Number(range[1]), Number(range[2]));
      const high = Math.max(Number(range[1]), Number(range[2]));
      if (high - low > 199) return { error: "한 번에 200개까지만 나눌 수 있습니다." };
      for (let number = low; number <= high; number += 1) units.push(String(number));
      continue;
    }
    units.push(token.slice(0, 20));
  }

  const unique = [...new Set(units)];
  if (unique.length > 200) return { error: "한 번에 200개까지만 나눌 수 있습니다." };
  return { units: unique };
}

export function listDates(start: string, end: string, weekdays: number[]) {
  const from = parseLocalDate(start);
  const to = parseLocalDate(end);
  if (!from || !to || to < from) return [];
  const allowed = new Set(weekdays);
  const dates: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to && dates.length < 400) {
    if (allowed.has(cursor.getDay())) dates.push(toDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function assignUnits(
  units: string[],
  dates: string[],
  dailyCap: number | null,
): { date: string; unit: string }[] | { error: string } {
  if (dates.length === 0) return { error: "선택한 요일과 목표일 사이에는 공부할 날이 없습니다." };
  if (dailyCap != null && dailyCap > 0) {
    const need = Math.ceil(units.length / dailyCap);
    if (dates.length < need) {
      return {
        error: `이 분량에는 공부할 날이 ${need}일 필요합니다. 요일을 늘리거나 하루 목표량을 높여 주세요.`,
      };
    }
    const used = dates.slice(0, need);
    return units.map((unit, index) => ({ unit, date: used[Math.floor(index / dailyCap)] }));
  }

  const base = Math.floor(units.length / dates.length);
  let extra = units.length % dates.length;
  const assigned: { date: string; unit: string }[] = [];
  let index = 0;
  for (const date of dates) {
    const count = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    for (let step = 0; step < count; step += 1) {
      assigned.push({ date, unit: units[index] });
      index += 1;
    }
  }
  return assigned;
}

export function buildStudyTasks(
  assigned: { date: string; unit: string }[],
  categoryId: StudyCategoryId,
  createId: () => string,
): PlanTask[] {
  return assigned.map((item) => ({
    id: createId(),
    title: /^\d+$/.test(item.unit) ? `${item.unit}번` : item.unit,
    done: false,
    createdOn: item.date,
    categoryId,
    kind: "study",
    href: `/study/${categoryId}`,
    auto: true,
    sourceId: null,
    reviewStep: 0,
  }));
}

export function replaceAutoTasks(tasks: PlanTask[], categoryId: StudyCategoryId, created: PlanTask[]) {
  const kept = tasks.filter((task) => !(task.auto && task.kind === "study" && !task.done && task.categoryId === categoryId));
  const doneTitles = new Set(
    kept.filter((task) => task.kind === "study" && task.done && task.categoryId === categoryId).map((task) => task.title),
  );
  return [...kept, ...created.filter((task) => !doneTitles.has(task.title))];
}

export function rebalanceOverdue(tasks: PlanTask[], today: string, examDate: string | null, weekdays: number[]) {
  const overdue = tasks.filter((task) => task.kind === "study" && !task.done && task.createdOn <= today);
  if (overdue.length === 0) return { tasks, moved: 0 };
  const tomorrow = addDays(today, 1) ?? today;
  const end = examDate && examDate >= tomorrow ? examDate : addDays(today, 28) ?? tomorrow;
  const openDays = listDates(tomorrow, end, weekdays);
  const dates = openDays.length > 0 ? openDays : [tomorrow];
  const assigned = assignUnits(
    overdue.map((task) => task.id),
    dates,
    null,
  );
  if ("error" in assigned) return { tasks, moved: 0 };
  const nextDate = new Map(assigned.map((item) => [item.unit, item.date]));
  return {
    moved: overdue.length,
    tasks: tasks.map((task) => {
      const date = nextDate.get(task.id);
      return date ? { ...task, createdOn: date } : task;
    }),
  };
}

export function applyTaskCheck(tasks: PlanTask[], id: string, done: boolean, today: string): PlanTask[] {
  const task = tasks.find((item) => item.id === id);
  if (!task) return tasks;
  const next = tasks.map((item) => (item.id === id ? { ...item, done } : item));
  const originId = task.kind === "review" && task.sourceId ? task.sourceId : task.id;

  if (!done) {
    if (task.kind === "study") {
      return next.filter((item) => !(item.kind === "review" && item.sourceId === task.id && !item.done));
    }
    return next.filter(
      (item) => !(item.kind === "review" && item.sourceId === originId && item.reviewStep > task.reviewStep && !item.done),
    );
  }

  const step = task.kind === "review" ? task.reviewStep : 0;
  if (step >= REVIEW_INTERVALS.length) return next;
  const when = addDays(today, REVIEW_INTERVALS[step]);
  if (!when) return next;
  const exists = next.some((item) => item.kind === "review" && item.sourceId === originId && item.reviewStep === step + 1);
  if (exists) return next;

  const subject = task.title.replace(/^복습 · /, "").slice(0, 70);
  const review: PlanTask = {
    id: crypto.randomUUID(),
    title: `복습 · ${subject}`.slice(0, 80),
    done: false,
    createdOn: when,
    categoryId: task.categoryId,
    kind: "review",
    href: task.href,
    auto: true,
    sourceId: originId,
    reviewStep: step + 1,
  };
  return [...next, review];
}
