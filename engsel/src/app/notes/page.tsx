import type { Metadata } from "next";
import { LegacyStudy } from "@/components/study/legacy-study";

export const metadata: Metadata = {
  title: "학습 노트 · EngSel 엥셀",
};

export default function NotesPage() {
  return <LegacyStudy hash="/notes" title="학습 노트" />;
}
