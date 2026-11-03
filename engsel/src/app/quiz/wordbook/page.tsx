import type { Metadata } from "next";
import { QuizPanel } from "@/components/quiz/quiz-panel";
import { getQuizTab } from "@/lib/quiz/tabs";

export const metadata: Metadata = {
  title: "단어장 · 문제 풀이 · EngSel 엥셀",
};

export default function WordbookPage() {
  return <QuizPanel tab={getQuizTab("/quiz/wordbook")} />;
}