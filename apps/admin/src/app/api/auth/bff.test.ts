// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "oakly_admin_rt" && cookieValue ? { value: cookieValue } : undefined) }),
}));

import { GET as proxyGet, POST as proxyPost } from "../v1/[...path]/route";
import { POST as logout } from "./logout/route";
import { POST as verify } from "./mfa/verify/route";
import { POST as refresh } from "./refresh/route";

const ADMIN = { id: "1", email: "a@example.test", full_name: "A", roles: [], permissions: ["dashboard.read"] };
const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://console.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "console.test", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let upstream: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.OAKLY_API_ORIGIN = "http://api.test";
  cookieValue = undefined;
  upstream = vi.fn();
  vi.stubGlobal("fetch", upstream);
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/auth/mfa/verify", () => {
  it("keeps the refresh token in an httpOnly SameSite=Strict cookie and out of the body", async () => {
    upstream.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "A", refresh_token: "R-secret", token_type: "bearer", expires_in: 900, admin: ADMIN }), { status: 200 }),
    );
    const res = await verify(post("/api/auth/mfa/verify", { mfa_token: "m", code: "123456" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ access_token: "A", expires_in: 900, admin: ADMIN });
    expect(JSON.stringify(body)).not.toContain("R-secret");

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("oakly_admin_rt=R-secret");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    expect(cookie).toContain("Path=/api/auth");
    expect(upstream).toHaveBeenCalledWith("http://api.test/api/v1/admin/auth/mfa/verify", expect.objectContaining({ method: "POST" }));
  });

  it("passes a backend 401 through without setting a cookie", async () => {
    upstream.mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid code" }), { status: 401 }));
    const res = await verify(post("/api/auth/mfa/verify", { mfa_token: "m", code: "000000" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid code" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a cross-origin request", async () => {
    const res = await verify(post("/api/auth/mfa/verify", {}, { origin: "https://evil.test" }));
    expect(res.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/refresh", () => {
  it("is 401 without a cookie and never calls the backend", async () => {
    const res = await refresh(post("/api/auth/refresh"));
    expect(res.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rotates the cookie with the new refresh token", async () => {
    cookieValue = "R-old";
    upstream.mockResolvedValue(new Response(JSON.stringify({ access_token: "A2", refresh_token: "R-new", expires_in: 900 }), { status: 200 }));
    const res = await refresh(post("/api/auth/refresh"));
    expect(await res.json()).toEqual({ access_token: "A2", expires_in: 900 });
    expect(res.headers.get("set-cookie")).toContain("oakly_admin_rt=R-new");
    expect(JSON.parse(String(upstream.mock.calls[0]?.[1]?.body))).toEqual({ refresh_token: "R-old" });
  });

  it("clears the cookie when the backend rejects the token (expired, revoked or reused)", async () => {
    cookieValue = "R-old";
    upstream.mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid refresh token" }), { status: 401 }));
    const res = await refresh(post("/api/auth/refresh"));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/oakly_admin_rt=;/);
  });

  it("keeps the cookie when the backend is down", async () => {
    cookieValue = "R-old";
    upstream.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await refresh(post("/api/auth/refresh"));
    expect(res.status).toBe(502);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes on the backend and clears the cookie", async () => {
    cookieValue = "R-old";
    upstream.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await logout(post("/api/auth/logout"));
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/oakly_admin_rt=;/);
    expect(upstream).toHaveBeenCalledWith("http://api.test/api/v1/admin/auth/logout", expect.anything());
  });

  it("still clears the cookie when the backend is down", async () => {
    cookieValue = "R-old";
    upstream.mockRejectedValue(new Error("down"));
    const res = await logout(post("/api/auth/logout"));
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/oakly_admin_rt=;/);
  });
});

describe("/api/v1 proxy", () => {
  const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

  it("forwards the bearer token and query string", async () => {
    upstream.mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = await proxyGet(
      new Request("http://console.test/api/v1/admin/caregivers?profile_status=approved", { headers: { authorization: "Bearer A", cookie: "oakly_admin_rt=leak" } }),
      ctx(["admin", "caregivers"]),
    );
    expect(res.status).toBe(200);
    const [url, init] = upstream.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://api.test/api/v1/admin/caregivers?profile_status=approved");
    const sent = new Headers(init.headers);
    expect(sent.get("authorization")).toBe("Bearer A");
    expect(sent.get("cookie")).toBeNull();
  });

  it.each([["mfa", "verify"], ["refresh"], ["logout"]])("refuses the session routes the BFF owns (%s)", async (...tail) => {
    const path = ["admin", "auth", ...tail];
    const res = await proxyPost(post(`/api/v1/${path.join("/")}`, {}), ctx(path));
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns 502 when the backend is unreachable", async () => {
    upstream.mockRejectedValue(new Error("down"));
    const res = await proxyGet(new Request("http://console.test/api/v1/admin/me"), ctx(["admin", "me"]));
    expect(res.status).toBe(502);
  });
});
