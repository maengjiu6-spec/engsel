export const quizTabs = [
  {
    href: "/quiz",
    label: "해석",
    description: "업로드한 영어 본문을 문장별로 나누고, 한글 해석과 나란히 비교합니다.",
  },
  {
    href: "/quiz/grammar",
    label: "어법 고르기",
    description: "본문에서 내신에 자주 나오는 어법 부분을 고르거나 고칩니다.",
  },
  {
    href: "/quiz/vocabulary",
    label: "어휘 고르기",
    description: "본문 맥락에 맞는 단어와 숙어를 객관식이나 빈칸으로 고릅니다.",
  },
  {
    href: "/quiz/past",
    label: "기출",
    description: "지난 시험 문제와 비슷한 유형을 풀고, 정답과 해설을 확인합니다.",
  },
  {
    href: "/quiz/wordbook",
    label: "단어장",
    description: "모르거나 틀린 단어를 모아 나만의 단어장으로 정리합니다.",
  },
] as const;

export type QuizTab = (typeof quizTabs)[number];

export function getQuizTab(href: QuizTab["href"]) {
  const tab = quizTabs.find((item) => item.href === href);
  if (!tab) {
    throw new Error(`Unknown quiz tab: ${href}`);
  }
  return tab;
}
