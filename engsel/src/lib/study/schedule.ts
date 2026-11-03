import type { DDay } from "@/types/study";

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function toDateInputValue(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getDDay(examDate: string, now: Date): DDay | null {
  const exam = parseLocalDate(examDate);
  if (!exam) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((exam.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft === 0) return { daysLeft, label: "D-Day" };
  if (daysLeft > 0) return { daysLeft, label: `D-${daysLeft}` };
  return { daysLeft, label: `D+${Math.abs(daysLeft)}` };
}

export function formatCountdown(examDate: string, now: Date) {
  const exam = parseLocalDate(examDate);
  if (!exam) return "시험일을 확인해 주세요.";
  const deadline = new Date(exam.getFullYear(), exam.getMonth(), exam.getDate(), 23, 59, 59);
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "시험일이 지났습니다.";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}
