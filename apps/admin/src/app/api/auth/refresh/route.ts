import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_AUTH_PATHS, type RefreshResponse, type RefreshedSession } from "@/lib/admin-auth-contract";
import { REFRESH_COOKIE, backendPost, refreshCookieOptions, sameOrigin } from "@/lib/server/backend";
import { flightKey, singleFlight } from "@/lib/server/single-flight";

/**
 * How long a finished refresh stays available to a request that still carries the old cookie.
 * It exists for concurrent refreshes (a second tab, or a request sent before the browser applied the
 * rotated cookie). Refresh tokens are single-use and reuse is theft evidence, so the window is kept
 * as short as that race allows: a replay after 2 s reaches the backend and trips its reuse detection.
 */
const LATE_CALLER_GRACE_MS = 2_000;

type Outcome =
  | { kind: "ok"; session: RefreshedSession; refreshToken: string }
  | { kind: "rejected"; status: number; body: unknown; clearCookie: boolean; retryAfter: string | null }
  | { kind: "unreachable" };

async function rotate(refreshToken: string): Promise<Outcome> {
  let upstream;
  try {
    upstream = await backendPost(ADMIN_AUTH_PATHS.refresh, { refresh_token: refreshToken });
  } catch {
    // Never retried: if the first attempt reached the server and only the answer was lost, a retry
    // would look like token theft and revoke every session (guide 4.2).
    return { kind: "unreachable" };
  }
  if (upstream.status !== 200 || !upstream.body) {
    return {
      kind: "rejected",
      status: upstream.status,
      body: upstream.body ?? { detail: "Session expired" },
      clearCookie: upstream.status === 401 || upstream.status === 403,
      retryAfter: upstream.headers.get("retry-after"),
    };
  }
  const tokens = upstream.body as RefreshResponse;
  return {
    kind: "ok",
    session: { access_token: tokens.access_token, expires_in: tokens.expires_in },
    refreshToken: tokens.refresh_token,
  };
}

/**
 * BFF for `POST /admin/auth/refresh`. The refresh token comes from the cookie and the rotated one is
 * written back. Refresh tokens are single-use and a repeat is treated as theft (every session of the
 * admin is revoked), so calls are SERIALISED per refresh token: concurrent requests with the same
 * cookie share one upstream call and all receive its result. A 401 from the backend (expired,
 * revoked, reused) clears the cookie; an unreachable backend does not, so a network blip doesn't
 * sign the admin out.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return NextResponse.json({ detail: "No session" }, { status: 401 });

  const outcome = await singleFlight(flightKey(refreshToken), () => rotate(refreshToken), {
    graceMs: LATE_CALLER_GRACE_MS,
    reusable: (o) => o.kind !== "unreachable",
  });

  if (outcome.kind === "unreachable") {
    return NextResponse.json({ detail: "Oakly API is unreachable" }, { status: 502 });
  }
  if (outcome.kind === "rejected") {
    const failed = NextResponse.json(outcome.body, { status: outcome.status });
    if (outcome.retryAfter) failed.headers.set("retry-after", outcome.retryAfter);
    if (outcome.clearCookie) failed.cookies.set(REFRESH_COOKIE, "", refreshCookieOptions(0));
    return failed;
  }
  const response = NextResponse.json(outcome.session, { headers: { "cache-control": "no-store" } });
  response.cookies.set(REFRESH_COOKIE, outcome.refreshToken, refreshCookieOptions());
  return response;
}
