export const features = [
  {
    href: "/passage",
    title: "본문",
    summary: "영어 본문을 붙여 넣거나 사진으로 등록합니다.",
    detail:
      "텍스트를 직접 입력하거나 본문 이미지를 올리면 글자를 읽어 옵니다. 확인한 뒤 본문을 저장합니다.",
  },
  {
    href: "/notes",
    title: "학습 노트",
    summary: "본문 필기와 오답 기록을 남겨 둡니다.",
    detail:
      "수정할 수 있는 디지털 노트에 필기와 한국어 정리, 오답을 쌓아 두고 나중에 다시 봅니다.",
  },
  {
    href: "/quiz",
    title: "문제 풀이",
    summary: "만든 문제를 화면에서 바로 풉니다.",
    detail:
      "생성된 문제를 컴퓨터에서 풀고, 정답의 근거가 된 원문 문장과 출제 이유를 함께 확인합니다.",
  },
  {
    href: "/rewrite",
    title: "한국어 정리",
    summary: "본문을 자기 말로 다시 정리합니다.",
    detail:
      "영어 본문을 자기만의 한국어로 다시 적고, 잘못 이해한 부분을 피드백으로 확인합니다.",
  },
  {
    href: "/plan",
    title: "학습 계획",
    summary: "시험 날짜에 맞춰 하루 분량을 나눕니다.",
    detail: "시험 날짜를 입력하면 남은 기간을 고려해 하루 학습 범위를 정합니다.",
  },
  {
    href: "/analytics",
    title: "약점 분석",
    summary: "틀린 이유를 항목별로 모아 보여 줍니다.",
    detail:
      "총점 대신 어휘, 문법, 해석처럼 영역별로 충분히 익힌 부분과 다시 볼 부분을 구분합니다.",
  },
  {
    href: "/assistant",
    title: "도우미",
    summary: "공부하다가 생긴 질문을 바로 묻습니다.",
    detail: "본문과 문제를 보다가 궁금한 점이 생기면 앱 안의 도우미에게 도움을 요청합니다.",
  },
] as const;

export type Feature = (typeof features)[number];

export function getFeature(href: Feature["href"]) {
  const feature = features.find((item) => item.href === href);
  if (!feature) {
    throw new Error(`Unknown feature: ${href}`);
  }
  return feature;
}
