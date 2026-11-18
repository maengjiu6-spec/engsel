import type { Metadata } from "next";
import { LegacyStudy } from "@/components/study/legacy-study";

export const metadata: Metadata = {
  title: "어법 고르기 · 문제 풀이 · EngSel 엥셀",
};

export default function GrammarPage() {
  return <LegacyStudy hash="/quiz/grammar" title="어법 고르기" />;
}
