"use client";

import Link from "next/link";
import { useState } from "react";
import { writeActiveCategory } from "@/lib/study/active-category";
import { studyCategories, type PlanTask, type StudyCategoryId } from "@/types/study";

const badgeTone: Record<StudyCategoryId, string> = {
  textbook: "bg-blue-50 text-blue-900",
  supplement: "bg-emerald-50 text-emerald-800",
  "mock-exam": "bg-violet-50 text-violet-800",
};

function categoryLabel(categoryId: StudyCategoryId) {
  return studyCategories.find((category) => category.id === categoryId)?.label ?? "학습";
}

function TaskRow({
  task,
  onToggle,
  onRemove,
}: {
  task: PlanTask;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <input
        id={`plan-task-${task.id}`}
        type="checkbox"
        checked={task.done}
        onChange={(event) => onToggle(task.id, event.target.checked)}
        className="size-4 shrink-0 accent-blue-900"
      />
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badgeTone[task.categoryId]}`}>
        {categoryLabel(task.categoryId)}
      </span>
      <Link
        href={task.href}
        onClick={() => writeActiveCategory(task.categoryId)}
        className={
          task.done
            ? "min-w-0 flex-1 text-sm text-stone-400 line-through"
            : "min-w-0 flex-1 text-sm text-stone-800 hover:text-blue-900"
        }
      >
        {task.title}
      </Link>
      <button
        type="button"
        onClick={() => onRemove(task.id)}
        className="shrink-0 text-sm text-stone-400 hover:text-stone-800"
        aria-label={`${task.title} 지우기`}
      >
        지우기
      </button>
    </li>
  );
}

export function PlanQueue({
  dateLabel,
  tasks,
  reviews,
  overdueCount,
  onAdd,
  onToggle,
  onRemove,
  onRebalance,
}: {
  dateLabel: string;
  tasks: PlanTask[];
  reviews: PlanTask[];
  overdueCount: number;
  onAdd: (title: string, categoryId: StudyCategoryId) => void;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
  onRebalance: () => void;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<StudyCategoryId>("textbook");
  const doneCount = tasks.filter((task) => task.done).length;

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8" aria-labelledby="plan-tasks-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="plan-tasks-heading" className="text-xl font-bold tracking-tight text-stone-900">
            {dateLabel} 학습
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">항목을 누르면 그 카테고리 학습 화면으로 이동합니다.</p>
        </div>
        <p className="text-sm font-medium text-stone-600">
          {tasks.length ? `${tasks.length}개 중 ${doneCount}개 완료` : "아직 없음"}
        </p>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={onRebalance}
          disabled={overdueCount === 0}
          className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:border-blue-900 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-stone-400"
        >
          밀린 분량 다시 나누기{overdueCount > 0 ? ` · ${overdueCount}개` : ""}
        </button>
      </div>

      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onAdd(title, categoryId);
          setTitle("");
        }}
      >
        <label className="sr-only" htmlFor="plan-task-category">
          카테고리
        </label>
        <select
          id="plan-task-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value as StudyCategoryId)}
          className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-800 outline-none focus:border-blue-900"
        >
          {studyCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="plan-task-title">
          할 일
        </label>
        <input
          id="plan-task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder="예: 3과 지문 분석"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-blue-900"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-xl bg-blue-900 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          추가
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-stone-50 px-4 py-5 text-sm leading-6 text-stone-500">
          이 날짜에 예정된 학습이 없습니다. 아래 분량 나누기로 일정을 만들 수 있습니다.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-stone-100">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={onToggle} onRemove={onRemove} />
          ))}
        </ul>
      )}

      {tasks.length > 0 && doneCount === tasks.length ? (
        <p className="mt-2 text-sm font-medium text-blue-900">이 날짜의 학습을 모두 마쳤습니다.</p>
      ) : null}

      <div className="mt-8 border-t border-stone-100 pt-6">
        <h3 className="text-lg font-bold tracking-tight text-stone-900">복습</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">끝낸 항목은 1일, 3일, 7일, 14일 뒤에 다시 나옵니다.</p>
        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">이 날짜의 복습은 없습니다.</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {reviews.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onRemove={onRemove} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
