import fs from "node:fs";
import path from "node:path";
import { createGoogle } from "@ai-sdk/google";

const defaultModel = "gemini-3.5-flash-lite";

function readEnvValue(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq < 1) return null;
  const key = trimmed.slice(0, eq).trim();
  if (key !== "GEMINI_API_KEY" && key !== "GEMINI_MODEL") return null;
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadRootEnv() {
  const files = [path.join(process.cwd(), "..", ".env"), path.join(process.cwd(), ".env")];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const entry = readEnvValue(line);
      if (!entry || process.env[entry.key]) continue;
      process.env[entry.key] = entry.value;
    }
  }
}

export function hasGeminiKey() {
  loadRootEnv();
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getEngselModel() {
  loadRootEnv();
  const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });
  return google(process.env.GEMINI_MODEL || defaultModel);
}

export const geminiProviderOptions = {
  google: {
    thinkingConfig: { thinkingLevel: "minimal" as const },
  },
};
