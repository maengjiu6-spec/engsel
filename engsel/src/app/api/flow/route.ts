import { postFlow } from "@/lib/ai/study-endpoints";

export const maxDuration = 60;

export function POST(request: Request) {
  return postFlow(request);
}
