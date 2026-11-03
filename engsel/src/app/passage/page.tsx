import type { Metadata } from "next";
import { Suspense } from "react";
import { PassageUploader } from "@/components/passage/passage-uploader";
import { isStudyCategoryId } from "@/lib/study/storage";
import type { StudyCategoryId } from "@/types/study";

export const metadata: Metadata = {
  title: "본문 업로드 · EngSel 엥셀",
  description: "영어 본문을 붙여 넣거나 사진에서 글자를 읽어 저장합니다.",
};

export default function PassagePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Suspense fallback={<p className="text-sm text-stone-500">본문 등록 화면을 준비하고 있습니다.</p>}>
        <PassagePageContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PassagePageContent({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;
  const initialCategoryId: StudyCategoryId | undefined = isStudyCategoryId(raw) ? raw : undefined;

  return <PassageUploader initialCategoryId={initialCategoryId} />;
}
