import { NextResponse } from "next/server";

import { ADMIN_AUTH_PATHS, type MfaVerifyResponse, type SignInSession } from "@/lib/admin-auth-contract";
import { REFRESH_COOKIE, backendPost, refreshCookieOptions, sameOrigin } from "@/lib/server/backend";

/**
 * BFF for `POST /admin/auth/mfa/verify`: passes the credentials through, keeps the refresh token in
 * an httpOnly cookie and returns only the access token and admin profile to the browser.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request" }, { status: 400 });
  }

  let upstream;
  try {
    upstream = await backendPost(ADMIN_AUTH_PATHS.mfaVerify, payload);
  } catch {
    return NextResponse.json({ detail: "Oakly API is unreachable" }, { status: 502 });
  }
  if (upstream.status !== 200 || !upstream.body) {
    const failed = NextResponse.json(upstream.body ?? { detail: "Verification failed" }, { status: upstream.status });
    // 423 (lockout, up to 86400 s) and 429 carry Retry-After; the console shows it.
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) failed.headers.set("retry-after", retryAfter);
    return failed;
  }

  const tokens = upstream.body as MfaVerifyResponse;
  const session: SignInSession = {
    access_token: tokens.access_token,
    expires_in: tokens.expires_in,
    admin: tokens.admin,
  };
  const response = NextResponse.json(session, { headers: { "cache-control": "no-store" } });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, refreshCookieOptions());
  return response;
}
