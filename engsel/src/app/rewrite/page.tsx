import type { Metadata } from "next";
import { LegacyStudy } from "@/components/study/legacy-study";

export const metadata: Metadata = {
  title: "한국어 정리 · EngSel 엥셀",
};

export default function RewritePage() {
  return <LegacyStudy hash="/rewrite" title="한국어 정리" />;
}
