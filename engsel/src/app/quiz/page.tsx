import type { Metadata } from "next";
import { LegacyStudy } from "@/components/study/legacy-study";

export const metadata: Metadata = {
  title: "문제 풀이 · EngSel 엥셀",
};

export default function QuizPage() {
  return <LegacyStudy hash="/quiz" title="문제 풀이" />;
}
