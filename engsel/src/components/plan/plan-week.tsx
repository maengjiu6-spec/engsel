import { dayStatus, weekDates, weekdayLabel } from "@/lib/study/plan-schedule";
import { parseLocalDate } from "@/lib/study/schedule";
import type { PlanTask } from "@/types/study";

const statusLabel = {
  empty: "예정 없음",
  done: "완료",
  active: "진행 중",
  missed: "미달성",
  planned: "예정",
} as const;

const statusDot = {
  empty: "bg-stone-200",
  done: "bg-blue-900",
  active: "bg-amber-400",
  missed: "bg-rose-400",
  planned: "bg-stone-400",
} as const;

function dayNumber(value: string) {
  return parseLocalDate(value)?.getDate() ?? "";
}

function weekdayIndex(value: string) {
  return parseLocalDate(value)?.getDay() ?? 0;
}

export function PlanWeek({
  selected,
  today,
  tasks,
  onSelect,
  onShift,
}: {
  selected: string;
  today: string;
  tasks: PlanTask[];
  onSelect: (date: string) => void;
  onShift: (days: number) => void;
}) {
  const days = weekDates(selected);

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-6" aria-labelledby="plan-week-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="plan-week-heading" className="text-xl font-bold tracking-tight text-stone-900">
          이번 주
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onShift(-7)}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:border-blue-900 hover:text-blue-900"
          >
            이전 주
          </button>
          <button
            type="button"
            onClick={() => onShift(7)}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:border-blue-900 hover:text-blue-900"
          >
            다음 주
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2" role="group" aria-label="월부터 일요일까지의 학습 상태">
        {days.map((date) => {
          const status = dayStatus(date, tasks, today);
          const pressed = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={pressed}
              onClick={() => onSelect(date)}
              className={`flex flex-col items-center rounded-2xl px-1 py-2 text-center ${
                pressed ? "bg-blue-50 ring-1 ring-blue-900" : "hover:bg-stone-50"
              }`}
            >
              <span className="text-xs text-stone-500">{weekdayLabel(weekdayIndex(date))}</span>
              <span className={`mt-1 text-sm font-semibold ${date === today ? "text-blue-900" : "text-stone-900"}`}>
                {dayNumber(date)}
              </span>
              <span className={`mt-2 size-2 rounded-full ${statusDot[status]}`} />
              <span className="sr-only">{statusLabel[status]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
        <span>파란 점 완료</span>
        <span>노란 점 진행 중</span>
        <span>회색 점 예정</span>
        <span>붉은 점 미달성</span>
      </p>
    </section>
  );
}
