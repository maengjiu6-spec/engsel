import { FeatureScreen } from "@/components/layout/feature-screen";
import { getFeature } from "@/lib/features";

export default function PlanPage() {
  return <FeatureScreen feature={getFeature("/plan")} />;
}
