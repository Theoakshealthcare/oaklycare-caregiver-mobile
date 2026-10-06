import { apiOrigin, sameOrigin } from "@/lib/server/backend";

/**
 * Same-origin proxy for the typed client: the browser calls `/api/v1/*` on this app and we forward to
 * `OAKLY_API_ORIGIN`. This avoids CORS entirely and keeps the backend origin out of the bundle.
 * The session-bearing auth routes are served by the BFF handlers under `/api/auth`, so the proxy
 * refuses them: the refresh token must never reach JavaScript.
 */
const BLOCKED = new Set(["admin/auth/mfa/verify", "admin/auth/refresh", "admin/auth/logout"]);
const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept", "accept-language"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "content-disposition", "content-length", "retry-after", "cache-control"];

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, { params }: Ctx): Promise<Response> {
  const { path } = await params;
  const joined = path.join("/");
  if (BLOCKED.has(joined)) return Response.json({ detail: "Not found" }, { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }

  const target = new URL(`${apiOrigin()}/api/v1/${joined}`);
  target.search = new URL(request.url).search;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
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
