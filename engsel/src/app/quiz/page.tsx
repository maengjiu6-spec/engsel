import type { Metadata } from "next";
import { QuizPanel } from "@/components/quiz/quiz-panel";
import { getQuizTab } from "@/lib/quiz/tabs";

export const metadata: Metadata = {
  title: "해석 · 문제 풀이 · EngSel 엥셀",
};

export default function TranslationPage() {
  return <QuizPanel tab={getQuizTab("/quiz")} />;
}
