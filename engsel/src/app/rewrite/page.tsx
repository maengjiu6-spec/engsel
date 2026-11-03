import { FeatureScreen } from "@/components/layout/feature-screen";
import { getFeature } from "@/lib/features";

export default function RewritePage() {
  return <FeatureScreen feature={getFeature("/rewrite")} />;
}
