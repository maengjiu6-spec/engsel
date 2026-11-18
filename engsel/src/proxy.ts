import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("127.0.0.1")) {
    const url = request.nextUrl.clone();
    url.protocol = "http:";
    url.hostname = "localhost";
    const location = url.toString();
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${location}"><title>EngSel 엥셀</title></head><body><script>location.replace(${JSON.stringify(location)})</script></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "x-engsel-origin": "localhost" },
    });
  }
  return NextResponse.next();
}
