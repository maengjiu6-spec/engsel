import { FeatureScreen } from "@/components/layout/feature-screen";
import { getFeature } from "@/lib/features";

export default function NotesPage() {
  return <FeatureScreen feature={getFeature("/notes")} />;
}
