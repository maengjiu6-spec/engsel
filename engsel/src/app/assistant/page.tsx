import { FeatureScreen } from "@/components/layout/feature-screen";
import { getFeature } from "@/lib/features";

export default function AssistantPage() {
  return <FeatureScreen feature={getFeature("/assistant")} />;
}
