import { openai } from "@ai-sdk/openai";

const defaultModel = "gpt-5.4-mini";

export function getEngselModel() {
  return openai(process.env.OPENAI_MODEL ?? defaultModel);
}
