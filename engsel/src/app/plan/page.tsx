import type { Metadata } from "next";
import { PlanDashboard } from "@/components/plan/plan-dashboard";

export const metadata: Metadata = {
  title: "학습 계획 · EngSel 엥셀",
};

export default function PlanPage() {
  return <PlanDashboard />;
}
