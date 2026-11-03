import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";
import { CategoryAccess } from "@/components/layout/category-access";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EngSel 엥셀",
  description: "혼자 준비하는 영어 내신을 위한 학습 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full bg-stone-50 text-stone-900">
        <SiteHeader />
        <CategoryAccess>{children}</CategoryAccess>
        <AssistantLauncher />
      </body>
    </html>
  );
}
