import {
  ADMIN_AUTH_PATHS,
  type AdminProfile,
  type LoginResponse,
  type SessionResponse,
} from "./admin-auth-contract";

/**
 * Client-side session core. The access token lives in this module's memory only: not in
 * localStorage, sessionStorage or a cookie. A page reload drops it and `refreshSession()` gets a
 * new one through the BFF, which holds the refresh token in an httpOnly cookie.
 */

let accessToken: string | null = null;
let inFlight: Promise<RefreshResult> | null = null;

export type RefreshResult =
  | { ok: true; session: SessionResponse }
  /** The session is over (no cookie, expired, revoked, reused): sign the admin out. */
  | { ok: false; reason: "expired" }
  /** The BFF or backend could not be reached: keep the admin signed in and let the caller retry. */
  | { ok: false; reason: "unreachable" };

type Listener = () => void;
const expiredListeners = new Set<Listener>();

/** Subscribe to "the session ended and cannot be recovered". Returns the unsubscribe function. */
export function onSessionExpired(listener: Listener): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Seconds from `Retry-After` on a 423 lockout. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function detailOf(body: unknown, fallback: string): string {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (typeof first?.msg === "string") return first.msg;
  }
  return fallback;
}

/**
 * Get a new access token via the BFF. Concurrent callers share one request: the refresh token
 * rotates on use and reuse revokes every session, so two parallel refreshes would sign the admin out.
 */
export function refreshSession(): Promise<RefreshResult> {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doRefresh(): Promise<RefreshResult> {
  let res: Response;
  try {
    res = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (res.ok) {
    const session = (await readJson(res)) as SessionResponse | null;
    if (session?.access_token) {
      accessToken = session.access_token;
      return { ok: true, session };
    }
    return { ok: false, reason: "unreachable" };
  }
  if (res.status === 401 || res.status === 403) {
    accessToken = null;
    return { ok: false, reason: "expired" };
  }
  return { ok: false, reason: "unreachable" };
}

/** Used by HTTP clients on a 401: returns a fresh token, or null (and announces expiry if the session is over). */
export async function recoverFromUnauthorized(): Promise<string | null> {
  const result = await refreshSession();
  if (result.ok) return result.session.access_token;
  if (result.reason === "expired") expiredListeners.forEach((l) => l());
  return null;
}

/** Step 1 of sign-in. Throws `AuthError` with the backend's message on 401, 423 (lockout) or 422. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(ADMIN_AUTH_PATHS.login, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    throw new AuthError("We couldn't reach Oakly. Check your connection and try again.", 0);
  }
  const body = await readJson(res);
  if (!res.ok) {
    const retry = Number(res.headers.get("retry-after"));
    throw new AuthError(
      detailOf(body, "Sign-in failed. Try again."),
      res.status,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }
  return body as LoginResponse;
}

/** Step 2 of sign-in (also completes MFA enrollment). The BFF stores the refresh token in the cookie. */
export async function verifyMfa(mfaToken: string, code: string): Promise<SessionResponse> {
  let res: Response;
  try {
    res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mfa_token: mfaToken, code }),
      cache: "no-store",
    });
  } catch {
    throw new AuthError("We couldn't reach Oakly. Check your connection and try again.", 0);
  }
  const body = await readJson(res);
  if (!res.ok) {
    const retry = Number(res.headers.get("retry-after"));
    throw new AuthError(
      detailOf(body, "That code didn't work."),
      res.status,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }
  const session = body as SessionResponse;
  accessToken = session.access_token;
  return session;
}

export async function logoutSession(): Promise<void> {
  accessToken = null;
  try {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
  } catch {
    // Offline: the cookie stays until the next attempt; the in-memory token is already gone.
  }
}

export type { AdminProfile };
