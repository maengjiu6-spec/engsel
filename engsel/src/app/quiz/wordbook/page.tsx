import type { Metadata } from "next";
import { LegacyStudy } from "@/components/study/legacy-study";

export const metadata: Metadata = {
  title: "단어장 · 문제 풀이 · EngSel 엥셀",
};

export default function WordbookPage() {
  return <LegacyStudy hash="/quiz/wordbook" title="단어장" />;
}
