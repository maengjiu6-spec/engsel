import type { Metadata } from "next";
import { LegacyStudy } from "@/components/study/legacy-study";

export const metadata: Metadata = {
  title: "어휘 고르기 · 문제 풀이 · EngSel 엥셀",
};

export default function VocabularyPage() {
  return <LegacyStudy hash="/quiz/vocabulary" title="어휘 고르기" />;
}
