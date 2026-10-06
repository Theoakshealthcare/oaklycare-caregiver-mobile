import { apiOrigin, sameOrigin } from "@/lib/server/backend";

/**
 * Same-origin proxy for the typed client: the browser calls `/api/v1/*` on this app and we forward to
 * `OAKLY_API_ORIGIN`. This avoids CORS entirely and keeps the backend origin out of the bundle.
 * The session-bearing auth routes are served by the BFF handlers under `/api/auth`, so the proxy
 * refuses them: the refresh token must never reach JavaScript.
 */
const BLOCKED = new Set(["admin/auth/mfa/verify", "admin/auth/refresh", "admin/auth/logout"]);
/** Only the backend areas the console actually calls are reachable through the proxy. */
const ALLOWED_PREFIXES = ["admin/", "caregiver/documents/"];
/** Request bodies above this are refused with 413 (the console sends small JSON only). */
const MAX_BODY_BYTES = 1024 * 1024;
const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept", "accept-language"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "content-disposition", "content-length", "retry-after", "cache-control"];

type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () => Response.json({ detail: "Not found" }, { status: 404 });

/** A decoded segment must be a single, plain path component: no separators, query/fragment, or dot-segments. */
function isSafeSegment(segment: string): boolean {
  return segment !== "" && segment !== "." && segment !== ".." && !/[/\\?#\u0000]/.test(segment);
}

/** Read the body, refusing anything over the cap even if Content-Length is absent or lies. */
async function readBodyCapped(request: Request): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

async function proxy(request: Request, { params }: Ctx): Promise<Response> {
  const { path } = await params;
  if (path.length === 0 || !path.every(isSafeSegment)) return notFound();
  const joined = path.join("/");
  const normalised = joined.toLowerCase();
  if (BLOCKED.has(normalised) || !ALLOWED_PREFIXES.some((p) => normalised.startsWith(p))) return notFound();
  if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }

  const base = new URL(apiOrigin());
  const target = new URL(`${base.origin}/api/v1/${path.map(encodeURIComponent).join("/")}`);
  if (target.origin !== base.origin || !target.pathname.startsWith("/api/v1/")) return notFound();
  target.search = new URL(request.url).search;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    const read = await readBodyCapped(request);
    if (!read) return Response.json({ detail: "Request body too large" }, { status: 413 });
    body = read;
  }
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return Response.json({ detail: "Oakly API is unreachable" }, { status: 502 });
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set("cache-control", "no-store");
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
