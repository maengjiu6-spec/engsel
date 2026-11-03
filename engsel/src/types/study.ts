export const questionTypes = [
  { id: "vocabulary", label: "단어장" },
  { id: "blank", label: "빈칸" },
  { id: "translation", label: "해석" },
  { id: "grammar", label: "어법" },
  { id: "word-order", label: "어순 배열" },
  { id: "match", label: "내용 일치" },
  { id: "mismatch", label: "내용 불일치" },
] as const;

export type QuestionType = (typeof questionTypes)[number]["id"];

export const weaknessAreas = [
  { id: "vocabulary", label: "어휘" },
  { id: "grammar", label: "문법" },
  { id: "translation", label: "해석" },
  { id: "content", label: "내용 이해" },
] as const;

export type WeaknessArea = (typeof weaknessAreas)[number]["id"];

export const studyCategories = [
  {
    id: "textbook",
    label: "교과서",
    description: "학교에서 배우는 교과서 본문",
  },
  {
    id: "supplement",
    label: "부교재",
    description: "부교재와 추가 학습 자료",
  },
  {
    id: "mock-exam",
    label: "모의고사",
    description: "모의고사 지문과 문제",
  },
] as const;

export type StudyCategoryId = (typeof studyCategories)[number]["id"];

export type Passage = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  categoryId: StudyCategoryId;
};

export type CategoryStudy = {
  categoryId: StudyCategoryId;
  examDate: string | null;
  progress: number;
  note: string;
};

export type DDay = {
  daysLeft: number;
  label: string;
};

export type StudyPlan = {
  examDate: string;
  dailyRange: string;
};
