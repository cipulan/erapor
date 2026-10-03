import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy same-origin /api/v1/* -> backend NestJS.
 *
 * Kenapa proxy, bukan fetch langsung dengan credentials:include?
 * - Backend tidak mengaktifkan CORS, sehingga fetch cross-origin (3000 -> 3001)
 *   akan ditolak browser.
 * - Dengan proxy, cookie sesi HttpOnly selalu same-origin: robust untuk
 *   dev (port berbeda) maupun docker (satu domain / service terpisah).
 * - API_URL hanya dibaca server-side; tidak ada secret/URL di bundle browser.
 */
const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");

// Header respons yang diteruskan dari backend ke browser.
const PASS_HEADERS = new Set([
  "content-type",
  "content-length",
  "content-disposition",
  "etag",
  "cache-control",
  "x-request-id",
]);

async function proxy(req: NextRequest, path: string[]) {
  const target = `${API_URL}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  const method = req.method.toUpperCase();

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const xRequestId = req.headers.get("x-request-id");
  if (xRequestId) headers.set("x-request-id", xRequestId);

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    // arrayBuffer meneruskan JSON maupun multipart/form-data apa adanya.
    body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body, redirect: "manual" });
  } catch {
    return NextResponse.json(
      { code: "UPSTREAM_UNREACHABLE", message: "Tidak dapat terhubung ke server API." },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (PASS_HEADERS.has(k.toLowerCase())) outHeaders.set(k, v);
  });
  // Teruskan Set-Cookie backend (login/logout) ke browser apa adanya.
  const setCookies: string[] =
    typeof (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (upstream.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : (() => {
          const single = upstream.headers.get("set-cookie");
          return single ? [single] : [];
        })();
  const res = new NextResponse(upstream.body, { status: upstream.status, headers: outHeaders });
  for (const c of setCookies) res.headers.append("set-cookie", c);
  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
