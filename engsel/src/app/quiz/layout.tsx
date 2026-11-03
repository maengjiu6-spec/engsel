import { ActivePassage } from "@/components/passage/active-passage";
import { QuizSubnav } from "@/components/quiz/quiz-subnav";

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium text-blue-900">학습</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">문제 풀이</h1>
        <p className="mt-3 max-w-2xl leading-7 text-stone-600">
          저장한 본문을 바탕으로 해석, 어법, 어휘, 기출, 단어장을 오가며 공부합니다.
        </p>
      </div>
      <ActivePassage />
      <QuizSubnav />
      {children}
    </main>
  );
}
