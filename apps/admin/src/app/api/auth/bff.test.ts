// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "oakly_admin_rt" && cookieValue ? { value: cookieValue } : undefined) }),
}));

import { _resetSingleFlight } from "@/lib/server/single-flight";
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
  _resetSingleFlight();
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

  it.each([[423, "86400"], [429, "30"]])("passes a %s and its Retry-After through", async (status, retryAfter) => {
    upstream.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Account temporarily locked. Try again later." }), { status, headers: { "retry-after": retryAfter } }),
    );
    const res = await verify(post("/api/auth/mfa/verify", { mfa_token: "m", code: "123456" }));
    expect(res.status).toBe(status);
    expect(res.headers.get("retry-after")).toBe(retryAfter);
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
    upstream.mockResolvedValue(new Response(JSON.stringify({ access_token: "A2", refresh_token: "R-new", token_type: "bearer", expires_in: 900 }), { status: 200 }));
    const res = await refresh(post("/api/auth/refresh"));
    expect(await res.json()).toEqual({ access_token: "A2", expires_in: 900 });
    expect(res.headers.get("set-cookie")).toContain("oakly_admin_rt=R-new");
    expect(JSON.parse(String(upstream.mock.calls[0]?.[1]?.body))).toEqual({ refresh_token: "R-old" });
  });

  it("clears the cookie when the backend rejects the token (expired, revoked or reused)", async () => {
    cookieValue = "R-old";
    upstream.mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid or expired refresh token" }), { status: 401 }));
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

describe("POST /api/auth/refresh serialisation (reuse detection revokes every session)", () => {
  const tokens = { access_token: "A2", refresh_token: "R-new", token_type: "bearer", expires_in: 900 };

  it("sends exactly one upstream refresh for concurrent requests carrying the same cookie", async () => {
    cookieValue = "R-old";
    upstream.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return new Response(JSON.stringify(tokens), { status: 200 });
    });
    const responses = await Promise.all(Array.from({ length: 6 }, () => refresh(post("/api/auth/refresh"))));
    expect(upstream).toHaveBeenCalledTimes(1);
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ access_token: "A2", expires_in: 900 });
      expect(res.headers.get("set-cookie")).toContain("oakly_admin_rt=R-new");
    }
  });

  it("serves a request that still carries the old cookie just after the rotation from the same result", async () => {
    cookieValue = "R-old";
    upstream.mockResolvedValue(new Response(JSON.stringify(tokens), { status: 200 }));
    await refresh(post("/api/auth/refresh"));
    const late = await refresh(post("/api/auth/refresh"));
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(late.status).toBe(200);
    expect(late.headers.get("set-cookie")).toContain("oakly_admin_rt=R-new");
  });

  it("stops serving the old cookie from the cached result after the 2 s grace window", async () => {
    vi.useFakeTimers();
    try {
      cookieValue = "R-old";
      upstream.mockResolvedValue(new Response(JSON.stringify(tokens), { status: 200 }));
      await refresh(post("/api/auth/refresh"));
      await vi.advanceTimersByTimeAsync(1_900);
      await refresh(post("/api/auth/refresh"));
      expect(upstream).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(200);
      upstream.mockResolvedValue(new Response(JSON.stringify(tokens), { status: 200 }));
      await refresh(post("/api/auth/refresh"));
      expect(upstream).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not serialise different sessions against each other", async () => {
    upstream.mockImplementation(async () => new Response(JSON.stringify(tokens), { status: 200 }));
    cookieValue = "R-one";
    await refresh(post("/api/auth/refresh"));
    cookieValue = "R-two";
    await refresh(post("/api/auth/refresh"));
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("shares a rejection too, and the cookie is cleared for every waiter", async () => {
    cookieValue = "R-old";
    upstream.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify({ detail: "Invalid or expired refresh token" }), { status: 401 });
    });
    const responses = await Promise.all([refresh(post("/api/auth/refresh")), refresh(post("/api/auth/refresh"))]);
    expect(upstream).toHaveBeenCalledTimes(1);
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.headers.get("set-cookie")).toMatch(/oakly_admin_rt=;/);
    }
  });

  it("never retries after a network error, and does not remember the failure", async () => {
    cookieValue = "R-old";
    upstream.mockRejectedValue(new Error("ECONNRESET"));
    const first = await refresh(post("/api/auth/refresh"));
    expect(first.status).toBe(502);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(first.headers.get("set-cookie")).toBeNull();
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

  it.each([
    [["admin", "auth", "refresh?x"]],
    [["admin", "auth", "refresh#x"]],
    [["admin", "me?x=1"]],
    [["admin", "..", "auth", "refresh"]],
    [["admin", ".", "me"]],
    [["admin", "auth/refresh"]],
    [["admin/auth/refresh"]],
    [["admin\\auth"]],
    [["admin", "", "me"]],
    [["ADMIN", "AUTH", "REFRESH"]],
    [["auth", "login"]],
    [["patient", "me"]],
    [[]],
  ])("rejects the bypass or off-allowlist path %j without calling the backend", async (path) => {
    const res = await proxyPost(post(`/api/v1/${path.join("/")}`, {}), ctx(path));
    expect([400, 404]).toContain(res.status);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("encodes each segment so a decoded character cannot change the upstream path", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    await proxyGet(new Request("http://console.test/api/v1/admin/caregivers/a%20b"), ctx(["admin", "caregivers", "a b"]));
    expect(String(upstream.mock.calls[0]?.[0])).toBe("http://api.test/api/v1/admin/caregivers/a%20b");
  });

  it("forwards the caregiver document file path", async () => {
    upstream.mockResolvedValue(new Response("pdf", { status: 200 }));
    const res = await proxyGet(
      new Request("http://console.test/api/v1/caregiver/documents/d1/file"),
      ctx(["caregiver", "documents", "d1", "file"]),
    );
    expect(res.status).toBe(200);
  });

  it.each([204, 205, 304])("passes a %i through without a body instead of failing", async (status) => {
    upstream.mockResolvedValue(new Response(null, { status }));
    const res = await proxyGet(new Request("http://console.test/api/v1/admin/me"), ctx(["admin", "me"]));
    expect(res.status).toBe(status);
    expect(res.body).toBeNull();
  });

  it("does not forward the upstream content-length (fetch may have decompressed the body)", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200, headers: { "content-length": "999" } }));
    const res = await proxyGet(new Request("http://console.test/api/v1/admin/me"), ctx(["admin", "me"]));
    expect(res.headers.get("content-length")).not.toBe("999");
  });

  it("rejects a body whose Content-Length is over 1 MB with 413", async () => {
    const res = await proxyPost(
      new Request("http://console.test/api/v1/admin/admins", {
        method: "POST",
        headers: { host: "console.test", "content-length": String(1024 * 1024 + 1) },
        body: "x",
      }),
      ctx(["admin", "admins"]),
    );
    expect(res.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects an over-1 MB body while reading even without a Content-Length", async () => {
    const big = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(256 * 1024));
      },
    });
    const res = await proxyPost(
      new Request("http://console.test/api/v1/admin/admins", {
        method: "POST",
        headers: { host: "console.test" },
        body: big,
        duplex: "half",
      } as RequestInit),
      ctx(["admin", "admins"]),
    );
    expect(res.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards a normal-sized body", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await proxyPost(post("/api/v1/admin/admins", { email: "a@example.test" }), ctx(["admin", "admins"]));
    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the backend is unreachable", async () => {
    upstream.mockRejectedValue(new Error("down"));
    const res = await proxyGet(new Request("http://console.test/api/v1/admin/me"), ctx(["admin", "me"]));
    expect(res.status).toBe(502);
  });
});
