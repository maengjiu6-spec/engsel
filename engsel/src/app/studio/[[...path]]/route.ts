import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";

const root = path.resolve(process.cwd(), "..", "engsel-web");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

export async function GET(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path: parts = [] } = await context.params;
  const relative = parts.length ? parts.join("/") : "index.html";
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    return new Response("not found", { status: 404 });
  }
  const type = types[path.extname(file)];
  if (!type) return new Response("not found", { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
