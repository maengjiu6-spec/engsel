import type { QuizTab } from "@/lib/quiz/tabs";

export function QuizPanel({ tab }: { tab: QuizTab }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="text-2xl font-bold tracking-tight text-stone-900">{tab.label}</h2>
      <p className="mt-3 text-lg text-stone-800">여기는 {tab.label} 화면입니다.</p>
      <p className="mt-2 max-w-2xl leading-7 text-stone-600">{tab.description}</p>
    </section>
  );
}
