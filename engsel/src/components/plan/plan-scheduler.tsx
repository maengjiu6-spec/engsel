"use client";

import { useState } from "react";
import { weekdayLabel } from "@/lib/study/plan-schedule";
import { studyCategories, type StudyCategoryId } from "@/types/study";

const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

export function PlanScheduler({
  examDate,
  weekdays,
  onClose,
  onCreate,
}: {
  examDate: string | null;
  weekdays: number[];
  onClose: () => void;
  onCreate: (input: {
    categoryId: StudyCategoryId;
    units: string;
    goalDate: string;
    weekdays: number[];
    dailyCap: number | null;
  }) => string | null;
}) {
  const [categoryId, setCategoryId] = useState<StudyCategoryId>("textbook");
  const [units, setUnits] = useState("");
  const [goalDate, setGoalDate] = useState(examDate ?? "");
  const [days, setDays] = useState<number[]>(weekdays);
  const [dailyCap, setDailyCap] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-scheduler-heading"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl sm:p-8"
      >
        <h2 id="plan-scheduler-heading" className="text-2xl font-bold tracking-tight text-stone-900">
          분량 나누기
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          범위와 목표일을 정하면 선택한 요일에 나눠 담습니다. 이미 끝낸 항목은 그대로 둡니다.
        </p>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const cap = dailyCap.trim() === "" ? null : Number.parseInt(dailyCap, 10);
            const message = onCreate({
              categoryId,
              units,
              goalDate,
              weekdays: days,
              dailyCap: cap != null && Number.isFinite(cap) && cap > 0 ? cap : null,
            });
            setError(message);
            if (!message) onClose();
          }}
        >
          <label className="text-sm font-medium text-stone-700">
            자료
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value as StudyCategoryId)}
              className="mt-2 block w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-900"
            >
              {studyCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-stone-700">
            학습 범위
            <input
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              placeholder="1-12 또는 1, 3, 5"
              className="mt-2 block w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-normal outline-none placeholder:text-stone-400 focus:border-blue-900"
            />
          </label>
          <label className="text-sm font-medium text-stone-700">
            목표 완료일
            <input
              type="date"
              value={goalDate}
              onChange={(event) => setGoalDate(event.target.value)}
              required
              className="mt-2 block w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-normal outline-none focus:border-blue-900"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-stone-700">학습 요일</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekdayOrder.map((day) => {
                const selected = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDay(day)}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      selected ? "bg-blue-900 text-white" : "border border-stone-200 text-stone-600"
                    }`}
                  >
                    {weekdayLabel(day)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="text-sm font-medium text-stone-700">
            하루 목표량 <span className="font-normal text-stone-400">비우면 날짜에 고르게 나눕니다</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={dailyCap}
              onChange={(event) => setDailyCap(event.target.value)}
              placeholder="예: 2"
              className="mt-2 block w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-normal outline-none placeholder:text-stone-400 focus:border-blue-900"
            />
          </label>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-medium text-stone-600">
              닫기
            </button>
            <button type="submit" className="rounded-xl bg-blue-900 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800">
              일정 만들기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
