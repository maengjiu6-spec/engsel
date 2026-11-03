import { generateText } from "ai";
import { getEngselModel } from "@/lib/ai/model";
import { PASSAGE_IMAGE_MAX_BYTES, passageImageMediaType } from "@/lib/passage/image";

export const maxDuration = 60;

const OCR_PROMPT = `Transcribe the English passage in this image.
Return only the English text, keeping the original paragraph breaks.
Do not translate, summarize, correct the author's wording, or add notes.
If a word is hard to read, write the closest reading.
If there is no English text, return an empty response.`;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "이미지 파일을 받지 못했습니다." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "이미지 파일을 선택해 주세요." }, { status: 400 });
  }

  const mediaType = passageImageMediaType(image);
  if (!mediaType) {
    return Response.json(
      { error: "PNG, JPG, WEBP, GIF 이미지만 올릴 수 있습니다." },
      { status: 400 },
    );
  }

  if (image.size === 0 || image.size > PASSAGE_IMAGE_MAX_BYTES) {
    return Response.json({ error: "이미지는 8MB 이하로 올려 주세요." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY가 없어 이미지를 읽을 수 없습니다. engsel/.env.local에 키를 넣은 뒤 개발 서버를 다시 시작해 주세요.",
      },
      { status: 500 },
    );
  }

  try {
    const bytes = new Uint8Array(await image.arrayBuffer());
    const { text } = await generateText({
      model: getEngselModel(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            {
              type: "file",
              mediaType,
              filename: image.name || "passage",
              data: bytes,
            },
          ],
        },
      ],
    });

    return Response.json({ text: cleanupTranscript(text) });
  } catch (error) {
    console.error("Passage OCR failed", error);
    return Response.json(
      { error: "이미지에서 글자를 읽지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}

function cleanupTranscript(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:text|markdown|english)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).replace(/\n{3,}/g, "\n\n").trim();
}
