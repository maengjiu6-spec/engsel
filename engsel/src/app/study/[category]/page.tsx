import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CategoryDashboard } from "@/components/study/category-dashboard";
import { isStudyCategoryId } from "@/lib/study/storage";
import type { StudyCategoryId } from "@/types/study";

const categoryLabels: Record<StudyCategoryId, string> = {
  textbook: "교과서",
  supplement: "부교재",
  "mock-exam": "모의고사",
};

export function generateStaticParams() {
  return (Object.keys(categoryLabels) as StudyCategoryId[]).map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = isStudyCategoryId(category) ? categoryLabels[category] : undefined;
  return { title: label ? `${label} · EngSel 엥셀` : "EngSel 엥셀" };
}

export default function StudyCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
          <p className="text-sm text-stone-500">학습 화면을 준비하고 있습니다.</p>
        </main>
      }
    >
      <StudyCategoryContent params={params} />
    </Suspense>
  );
}

async function StudyCategoryContent({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isStudyCategoryId(category)) notFound();

  return <CategoryDashboard categoryId={category as StudyCategoryId} />;
}
