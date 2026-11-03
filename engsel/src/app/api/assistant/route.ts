import { generateText } from "ai";
import { z } from "zod";
import { getEngselModel } from "@/lib/ai/model";

export const maxDuration = 60;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  passage: z
    .object({
      title: z.string().max(200),
      body: z.string().max(12000),
    })
    .nullable()
    .optional(),
});

const SYSTEM_PROMPT = `당신은 EngSel 엥셀의 영어 내신 학습 도우미입니다.
학생의 질문에 한국어로 짧고 분명하게 답합니다.
문법, 어휘, 해석, 본문 이해를 설명할 때는 근거가 되는 영어 표현을 함께 보여 줍니다.
현재 본문이 주어지면 그 내용을 우선해서 답하고, 본문에 없는 내용은 없다고 말합니다.`;

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "질문을 받지 못했습니다." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return Response.json({ error: "질문 내용을 확인해 주세요." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY가 없어 도우미가 답할 수 없습니다. engsel/.env.local에 키를 넣은 뒤 개발 서버를 다시 시작해 주세요.",
      },
      { status: 500 },
    );
  }

  const passage = parsed.data.passage;
  const passageNote = passage
    ? `\n\n현재 본문 제목: ${passage.title}\n현재 본문:\n${passage.body}`
    : "";

  try {
    const { text } = await generateText({
      model: getEngselModel(),
      system: `${SYSTEM_PROMPT}${passageNote}`,
      messages: parsed.data.messages,
    });

    const answer = text.trim();
    if (!answer) {
      return Response.json({ error: "도우미가 답을 만들지 못했습니다." }, { status: 502 });
    }

    return Response.json({ text: answer });
  } catch (error) {
    console.error("Assistant reply failed", error);
    return Response.json({ error: "도우미가 답을 하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
