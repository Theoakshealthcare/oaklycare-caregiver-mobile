/** Server-side helpers for the BFF route handlers. Only route handlers import this; it reads server env. */

export const REFRESH_COOKIE = "oakly_admin_rt";
/** The refresh cookie is only sent to our BFF auth routes, never to the proxy or pages. */
export const REFRESH_COOKIE_PATH = "/api/auth";
/** GUESS: the plan does not state the admin refresh TTL. The backend is the authority; this only bounds the cookie. */
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export function apiOrigin(): string {
  const origin = process.env.OAKLY_API_ORIGIN;
  if (!origin) throw new Error("OAKLY_API_ORIGIN is not set");
  return origin.replace(/\/+$/, "");
}

export function refreshCookieOptions(maxAge: number = REFRESH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: REFRESH_COOKIE_PATH,
    maxAge,
  };
}

/** POST JSON to the backend. Returns the status and parsed body (null when empty or not JSON). */
export async function backendPost(
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res = await fetch(`${apiOrigin()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

/**
 * Cross-site POSTs are already blocked by SameSite=Strict; this also refuses a request whose
 * Origin names another host, so a misconfigured cookie setting can't open a CSRF hole.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
