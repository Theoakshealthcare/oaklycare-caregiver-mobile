import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_AUTH_PATHS } from "@/lib/admin-auth-contract";
import { REFRESH_COOKIE, backendPost, refreshCookieOptions, sameOrigin } from "@/lib/server/backend";

/**
 * BFF for `POST /admin/auth/logout`: revokes the refresh token on the backend (best effort) and
 * always clears the cookie, so the browser is signed out even if the backend is down.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await backendPost(ADMIN_AUTH_PATHS.logout, { refresh_token: refreshToken });
    } catch {
      // The token expires on its own; the cookie is cleared below regardless.
    }
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(REFRESH_COOKIE, "", refreshCookieOptions(0));
  return response;
}
