"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PlanQueue } from "@/components/plan/plan-queue";
import { PlanScheduler } from "@/components/plan/plan-scheduler";
import { PlanWeek } from "@/components/plan/plan-week";
import { addDays, applyTaskCheck, assignUnits, buildStudyTasks, listDates, parseUnitInput, rebalanceOverdue, replaceAutoTasks } from "@/lib/study/plan-schedule";
import {
  parseLearningPlan,
  readLearningPlanServerSnapshot,
  readLearningPlanSnapshot,
  subscribeLearningPlan,
  writeLearningPlan,
} from "@/lib/study/plan-storage";
import { formatCountdown, formatExamDate, getDDay, parseLocalDate, toDateInputValue } from "@/lib/study/schedule";
import type { StudyCategoryId } from "@/types/study";

export function PlanDashboard() {
  const snapshot = useSyncExternalStore(
    subscribeLearningPlan,
    readLearningPlanSnapshot,
    readLearningPlanServerSnapshot,
  );
  const plan = useMemo(() => parseLearningPlan(snapshot), [snapshot]);
  const [now, setNow] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const start = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, []);

  const today = now ? toDateInputValue(now) : null;
  const activeDate = selected ?? today;
  const studyTasks = plan.tasks.filter((task) => task.kind === "study");
  const doneStudyCount = studyTasks.filter((task) => task.done).length;
  const progress = studyTasks.length === 0 ? 0 : Math.round((doneStudyCount / studyTasks.length) * 100);
  const dayTasks = activeDate ? plan.tasks.filter((task) => task.createdOn === activeDate && task.kind === "study") : [];
  const dayReviews = activeDate ? plan.tasks.filter((task) => task.createdOn === activeDate && task.kind === "review") : [];
  const overdueCount = today ? plan.tasks.filter((task) => task.kind === "study" && !task.done && task.createdOn <= today).length : 0;
  const dateLabel = activeDate ? formatShortDate(activeDate) : "선택한 날";

  const saveExam = (examLabel: string, examDate: string | null) => {
    try {
      writeLearningPlan({ ...plan, examLabel, examDate });
    } catch {
      return;
    }
  };

  const addTask = (title: string, categoryId: StudyCategoryId) => {
    const trimmed = title.trim();
    if (!trimmed || !activeDate) return;
    try {
      writeLearningPlan({
        ...plan,
        tasks: [
          ...plan.tasks,
          {
            id: crypto.randomUUID(),
            title: trimmed,
            done: false,
            createdOn: activeDate,
            categoryId,
            kind: "study",
            href: `/study/${categoryId}`,
            auto: false,
            sourceId: null,
            reviewStep: 0,
          },
        ],
      });
    } catch {
      return;
    }
  };

  const toggleTask = (id: string, done: boolean) => {
    if (!today) return;
    try {
      writeLearningPlan({ ...plan, tasks: applyTaskCheck(plan.tasks, id, done, today) });
    } catch {
      return;
    }
  };

  const rebalance = () => {
    if (!today) return;
    const result = rebalanceOverdue(plan.tasks, today, plan.examDate, plan.weekdays);
    if (result.moved === 0) return;
    try {
      writeLearningPlan({ ...plan, tasks: result.tasks });
      setNotice(`밀린 ${result.moved}개를 남은 날에 다시 나눴습니다.`);
    } catch {
      return;
    }
  };

  const createSchedule = (input: {
    categoryId: StudyCategoryId;
    units: string;
    goalDate: string;
    weekdays: number[];
    dailyCap: number | null;
  }) => {
    if (!today) return "날짜를 확인한 뒤 다시 시도해 주세요.";
    if (input.weekdays.length === 0) return "학습 요일을 하루 이상 골라 주세요.";
    const parsed = parseUnitInput(input.units);
    if ("error" in parsed) return parsed.error;
    const start = today > input.goalDate ? input.goalDate : today;
    const dates = listDates(start, input.goalDate, input.weekdays);
    const assigned = assignUnits(parsed.units, dates, input.dailyCap);
    if ("error" in assigned) return assigned.error;
    const created = buildStudyTasks(assigned, input.categoryId, () => crypto.randomUUID());
    try {
      writeLearningPlan({
        ...plan,
        weekdays: input.weekdays,
        tasks: replaceAutoTasks(plan.tasks, input.categoryId, created),
      });
    } catch {
      return "이 브라우저에 일정을 저장하지 못했습니다.";
    }
    const first = created[0]?.createdOn;
    if (first) setSelected(first);
    setNotice(`${created.length}개를 선택한 요일에 나눴습니다.`);
    return null;
  };

  const removeTask = (id: string) => {
    try {
      writeLearningPlan({
        ...plan,
        tasks: plan.tasks.filter((task) => task.id !== id),
      });
    } catch {
      return;
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-blue-900">시험까지 남긴 공부</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-stone-900">학습 계획</h1>
        <p className="mt-4 text-lg leading-8 text-stone-600">
          시험까지 남은 날과 날짜별 할 일을 확인합니다.
        </p>
      </header>

      <ExamCard
        label={plan.examLabel}
        examDate={plan.examDate}
        now={now}
        progress={progress}
        doneCount={doneStudyCount}
        totalCount={studyTasks.length}
        onSave={saveExam}
      />

      {notice ? (
        <p role="status" className="text-sm font-medium text-blue-900">
          {notice}
        </p>
      ) : null}

      {activeDate && today ? (
        <PlanWeek
          selected={activeDate}
          today={today}
          tasks={plan.tasks}
          onSelect={setSelected}
          onShift={(days) => setSelected(addDays(activeDate, days) ?? activeDate)}
        />
      ) : (
        <p className="text-sm text-stone-500">이번 주 일정을 준비하고 있습니다.</p>
      )}

      <PlanQueue
        dateLabel={dateLabel}
        tasks={dayTasks}
        reviews={dayReviews}
        overdueCount={overdueCount}
        onAdd={addTask}
        onToggle={toggleTask}
        onRemove={removeTask}
        onRebalance={rebalance}
      />

      <div>
        <button
          type="button"
          onClick={() => setSchedulerOpen(true)}
          className="rounded-xl bg-blue-900 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800"
        >
          분량 나누기
        </button>
      </div>

      {schedulerOpen ? (
        <PlanScheduler
          examDate={plan.examDate}
          weekdays={plan.weekdays}
          onClose={() => setSchedulerOpen(false)}
          onCreate={createSchedule}
        />
      ) : null}
    </main>
  );
}

function ExamCard({
  label,
  examDate,
  now,
  progress,
  doneCount,
  totalCount,
  onSave,
}: {
  label: string;
  examDate: string | null;
  now: Date | null;
  progress: number;
  doneCount: number;
  totalCount: number;
  onSave: (label: string, examDate: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftDate, setDraftDate] = useState(examDate ?? "");
  const dday = examDate && now ? getDDay(examDate, now) : null;
  const countdown = examDate && now ? formatCountdown(examDate, now) : null;
  const open = editing || !examDate;

  const startEditing = () => {
    setDraftLabel(label);
    setDraftDate(examDate ?? "");
    setEditing(true);
  };

  const save = () => {
    onSave(draftLabel, draftDate || null);
    setEditing(false);
  };

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8" aria-labelledby="plan-dday-heading">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="plan-dday-heading" className="text-sm font-medium text-stone-500">
            {label.trim() || "목표 시험"}
          </h2>
          <p className="mt-2 text-5xl font-bold tracking-tight text-blue-900">{dday?.label ?? "시험일 미정"}</p>
          <p className="mt-3 text-sm text-stone-600">
            {examDate ? formatExamDate(examDate) : "수능이나 학교 시험처럼 목표일을 정해 두세요."}
          </p>
          <p className="mt-1 text-sm text-stone-500" aria-live="polite">
            {countdown ?? "시험일을 정하면 남은 시간이 표시됩니다."}
          </p>
          <div className="mt-5 max-w-md">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>전체 진행률</span>
              <span>
                {progress}% · {doneCount}/{totalCount}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="전체 학습 진행률"
            >
              <div className="h-full rounded-full bg-blue-900" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        {examDate && !open ? (
          <button
            type="button"
            onClick={startEditing}
            className="self-start rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-blue-900 hover:text-blue-900"
          >
            날짜 수정
          </button>
        ) : null}
      </div>

      {open ? (
        <form
          className="mt-8 grid gap-4 border-t border-stone-100 pt-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="text-sm font-medium text-stone-700">
            시험 이름
            <input
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              maxLength={40}
              placeholder="수능"
              className="mt-2 block w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-normal text-stone-900 outline-none placeholder:text-stone-400 focus:border-blue-900"
            />
          </label>
          <label className="text-sm font-medium text-stone-700">
            시험일
            <input
              type="date"
              value={draftDate}
              onChange={(event) => setDraftDate(event.target.value)}
              required
              className="mt-2 block w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-normal text-stone-900 outline-none focus:border-blue-900"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800"
            >
              저장
            </button>
            {examDate ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-stone-600 hover:text-stone-900"
              >
                취소
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
function formatShortDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
}
