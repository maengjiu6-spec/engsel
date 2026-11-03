import { CategoryCards } from "@/components/home/category-cards";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-blue-900">혼자 준비하는 영어 내신</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">EngSel 엥셀</h1>
        <p className="mt-4 text-lg leading-8 text-stone-600">
          교과서, 부교재, 모의고사 중에서 공부할 자료를 고르세요.
        </p>
      </section>
      <CategoryCards />
    </main>
  );
}
