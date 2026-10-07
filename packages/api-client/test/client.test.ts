import assert from "node:assert/strict";
import { test } from "node:test";

import { createOaklyClient, errorMessage } from "../src/index.ts";

function fakeFetch(handler: (req: Request) => Response) {
  const calls: Request[] = [];
  const fn = async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return handler(req);
  };
  return { fn: fn as typeof fetch, calls };
}

test("adds the bearer token", async () => {
  const f = fakeFetch(() => Response.json({ ok: true }));
  const api = createOaklyClient({ baseUrl: "http://x", getAccessToken: () => "tok", fetch: f.fn });
  await api.GET("/api/v1/auth/me");
  assert.equal(f.calls[0]?.headers.get("Authorization"), "Bearer tok");
});

test("refreshes once on 401 and retries with the new token", async () => {
  const f = fakeFetch((req) =>
    req.headers.get("Authorization") === "Bearer new"
      ? Response.json({ email: "a@example.com" })
      : Response.json({ detail: "Could not validate credentials" }, { status: 401 }),
  );
  let refreshes = 0;
  const api = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => "old",
    onUnauthorized: async () => (refreshes++, "new"),
    fetch: f.fn,
  });
  const { data, response } = await api.GET("/api/v1/auth/me");
  assert.equal(response.status, 200);
  assert.equal((data as { email: string }).email, "a@example.com");
  assert.equal(refreshes, 1);
});

test("does not loop when the refreshed token is also rejected", async () => {
  const f = fakeFetch(() => Response.json({ detail: "nope" }, { status: 401 }));
  let refreshes = 0;
  const api = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => "old",
    onUnauthorized: async () => (refreshes++, "new"),
    fetch: f.fn,
  });
  const { response } = await api.GET("/api/v1/auth/me");
  assert.equal(response.status, 401);
  assert.equal(refreshes, 1);
  assert.equal(f.calls.length, 2);
});

test("gives up when refresh returns null", async () => {
  const f = fakeFetch(() => Response.json({ detail: "expired" }, { status: 401 }));
  const api = createOaklyClient({ baseUrl: "http://x", getAccessToken: () => "old", onUnauthorized: async () => null, fetch: f.fn });
  const { response } = await api.GET("/api/v1/auth/me");
  assert.equal(response.status, 401);
  assert.equal(f.calls.length, 1);
});

test("errorMessage reads every FastAPI detail shape", () => {
  assert.equal(errorMessage({ detail: "Not found" }), "Not found");
  assert.equal(errorMessage({ detail: [{ msg: "field required" }] }), "field required");
  assert.equal(errorMessage({ detail: { message: "Cannot approve", unmet: [] } }), "Cannot approve");
  assert.equal(errorMessage(undefined, "fallback"), "fallback");
});

test("retries a request WITH a body after refresh (body is consumed by the first fetch)", async () => {
  const seen: string[] = [];
  const consumingFetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    seen.push(await req.text()); // consumes the body, as real fetch implementations do
    return req.headers.get("Authorization") === "Bearer new"
      ? Response.json({ ok: true })
      : Response.json({ detail: "expired" }, { status: 401 });
  }) as typeof fetch;
  const api = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => "old",
    onUnauthorized: async () => "new",
    fetch: consumingFetch,
  });
  const { response } = await api.POST("/api/v1/caregiver/availability", { body: { is_available: true } });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, ['{"is_available":true}', '{"is_available":true}']);
});

// React Native's fetch returns responses that are not `instanceof` the global Response (seen on Expo
// SDK 57 in the iOS simulator). openapi-fetch rejects any onResponse result that fails that check, so
// the middleware must not hand such an object back. This proxy behaves like a Response but fails
// `instanceof Response`, as the React Native one does.
function foreign(response: Response): Response {
  return new Proxy(response, {
    getPrototypeOf: () => Object.prototype,
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Response;
}

test("works when fetch returns a Response that is not instanceof the global Response (React Native)", async () => {
  const f = fakeFetch(() => foreign(Response.json({ email: "a@example.com" })));
  const api = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => "tok",
    onUnauthorized: async () => "new",
    fetch: f.fn,
  });
  const { data, error } = await api.GET("/api/v1/auth/me");
  assert.equal(error, undefined);
  assert.equal((data as { email: string }).email, "a@example.com");
});

test("an unauthenticated call with a foreign Response also works (login)", async () => {
  const f = fakeFetch(() => foreign(Response.json({ detail: "Incorrect email or password" }, { status: 401 })));
  const api = createOaklyClient({ baseUrl: "http://x", getAccessToken: () => null, onUnauthorized: async () => "new", fetch: f.fn });
  const { error, response } = await api.POST("/api/v1/auth/login/mobile", {
    body: { email_or_phone: "a@example.com", password: "x" },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(error, { detail: "Incorrect email or password" });
});

test("the retry after a refresh still works when fetch returns foreign Responses", async () => {
  const f = fakeFetch((req) =>
    foreign(
      req.headers.get("Authorization") === "Bearer new"
        ? Response.json({ email: "a@example.com" }, { headers: { "Retry-After": "3" } })
        : Response.json({ detail: "expired" }, { status: 401 }),
    ),
  );
  const api = createOaklyClient({ baseUrl: "http://x", getAccessToken: () => "old", onUnauthorized: async () => "new", fetch: f.fn });
  const { data, response } = await api.GET("/api/v1/auth/me");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Retry-After"), "3");
  assert.equal((data as { email: string }).email, "a@example.com");
});
