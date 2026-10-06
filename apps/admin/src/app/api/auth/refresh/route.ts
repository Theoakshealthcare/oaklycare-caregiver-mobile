import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_AUTH_PATHS, type RefreshResponse, type SessionResponse } from "@/lib/admin-auth-contract";
import { REFRESH_COOKIE, backendPost, refreshCookieOptions, sameOrigin } from "@/lib/server/backend";

/**
 * BFF for `POST /admin/auth/refresh`. The refresh token comes from the cookie and the rotated one is
 * written back. A 401 from the backend (expired, revoked, reused) clears the cookie; an unreachable
 * backend does not, so a network blip doesn't sign the admin out.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return NextResponse.json({ detail: "No session" }, { status: 401 });

  let upstream;
  try {
    upstream = await backendPost(ADMIN_AUTH_PATHS.refresh, { refresh_token: refreshToken });
  } catch {
    return NextResponse.json({ detail: "Oakly API is unreachable" }, { status: 502 });
  }

  if (upstream.status !== 200 || !upstream.body) {
    const failed = NextResponse.json(upstream.body ?? { detail: "Session expired" }, { status: upstream.status });
    if (upstream.status === 401 || upstream.status === 403) {
      failed.cookies.set(REFRESH_COOKIE, "", refreshCookieOptions(0));
    }
    return failed;
  }

  const tokens = upstream.body as RefreshResponse;
  const session: SessionResponse = {
    access_token: tokens.access_token,
    expires_in: tokens.expires_in,
    admin: tokens.admin,
  };
  const response = NextResponse.json(session, { headers: { "cache-control": "no-store" } });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, refreshCookieOptions());
  return response;
}
