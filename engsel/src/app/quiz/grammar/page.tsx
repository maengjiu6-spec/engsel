import type { Metadata } from "next";
import { QuizPanel } from "@/components/quiz/quiz-panel";
import { getQuizTab } from "@/lib/quiz/tabs";

export const metadata: Metadata = {
  title: "어법 고르기 · 문제 풀이 · EngSel 엥셀",
};

export default function GrammarPage() {
  return <QuizPanel tab={getQuizTab("/quiz/grammar")} />;
}
