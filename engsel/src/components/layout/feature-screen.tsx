import { ActivePassage } from "@/components/passage/active-passage";
import type { Feature } from "@/lib/features";

export function FeatureScreen({ feature }: { feature: Feature }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10">
      <ActivePassage />
      <p className="text-sm font-medium text-blue-900">아직 화면만 준비된 기능입니다.</p>
      <h1 className="text-3xl font-bold tracking-tight text-stone-900">{feature.title}</h1>
      <p className="text-lg leading-8 text-stone-600">{feature.detail}</p>
    </article>
  );
}
