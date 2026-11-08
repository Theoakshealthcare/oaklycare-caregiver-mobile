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

test("multipart goes through plain fetch(url, init), never a Request, with auth and no Content-Type", async () => {
  const seen: { input: unknown; init?: RequestInit }[] = [];
  const fn = (async (input: unknown, init?: RequestInit) => {
    seen.push({ input, init });
    return Response.json({ id: 1 });
  }) as typeof fetch;
  const api = createOaklyClient({ baseUrl: "http://x/", getAccessToken: () => "tok", fetch: fn });
  const form = new FormData();
  form.append("document_type", "license");
  const { data, response } = await api.uploadMultipart("/api/v1/caregiver/documents/upload", form);
  assert.equal(response.status, 200);
  assert.deepEqual(data, { id: 1 });
  assert.equal(seen.length, 1);
  // A FormData body inside a Request object is exactly what React Native cannot send.
  assert.equal(seen[0]?.input instanceof Request, false);
  assert.equal(seen[0]?.input, "http://x/api/v1/caregiver/documents/upload");
  assert.equal(seen[0]?.init?.body, form);
  assert.equal(seen[0]?.init?.method, "POST");
  const headers = seen[0]?.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer tok");
  assert.equal(Object.keys(headers).some((k) => k.toLowerCase() === "content-type"), false);
});

test("multipart refreshes once on 401 and re-sends the same form with the new token", async () => {
  const bodies: unknown[] = [];
  const fn = (async (_input: unknown, init?: RequestInit) => {
    bodies.push(init?.body);
    const auth = (init?.headers as Record<string, string>).Authorization;
    return auth === "Bearer new" ? Response.json({ ok: true }) : Response.json({ detail: "expired" }, { status: 401 });
  }) as typeof fetch;
  let refreshes = 0;
  const api = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => "old",
    onUnauthorized: async () => (refreshes++, "new"),
    fetch: fn,
  });
  const form = new FormData();
  const { response } = await api.uploadMultipart("/up", form);
  assert.equal(response.status, 200);
  assert.equal(refreshes, 1);
  assert.deepEqual(bodies, [form, form]);
});

test("multipart returns the error body for a non-2xx and rethrows a fetch rejection untouched", async () => {
  const bad = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => null,
    fetch: (async () => Response.json({ detail: "File too large" }, { status: 413 })) as typeof fetch,
  });
  const result = await bad.uploadMultipart("/up", new FormData());
  assert.equal(result.response.status, 413);
  assert.deepEqual(result.error, { detail: "File too large" });

  const offline = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => null,
    fetch: (async () => {
      throw new TypeError("Network request failed");
    }) as typeof fetch,
  });
  await assert.rejects(offline.uploadMultipart("/up", new FormData()), TypeError);
});

test("raw bytes go through plain fetch(url, init) with the file's own Content-Type, auth, and one refresh on 401", async () => {
  const seen: { input: unknown; init?: RequestInit }[] = [];
  const fn = (async (input: unknown, init?: RequestInit) => {
    seen.push({ input, init });
    const auth = (init?.headers as Record<string, string>).Authorization;
    return auth === "Bearer new" ? Response.json({ id: "n1" }, { status: 202 }) : Response.json({ detail: "expired" }, { status: 401 });
  }) as typeof fetch;
  let refreshes = 0;
  const api = createOaklyClient({
    baseUrl: "http://x/",
    getAccessToken: () => "old",
    onUnauthorized: async () => (refreshes++, "new"),
    fetch: fn,
  });
  const bytes = new Uint8Array([1, 2, 3]);
  const { data, response } = await api.uploadBytes("/api/v1/caregiver/voice-notes/n1/audio", bytes, "audio/mp4");
  assert.equal(response.status, 202);
  assert.deepEqual(data, { id: "n1" });
  assert.equal(refreshes, 1);
  assert.equal(seen.length, 2);
  assert.equal(seen[0]?.input instanceof Request, false);
  assert.equal(seen[0]?.input, "http://x/api/v1/caregiver/voice-notes/n1/audio");
  assert.equal(seen[1]?.init?.body, bytes);
  assert.equal(seen[1]?.init?.method, "PUT");
  const headers = seen[1]?.init?.headers as Record<string, string>;
  assert.equal(headers["Content-Type"], "audio/mp4");
  assert.equal(headers.Authorization, "Bearer new");
});

test("raw bytes return the error body of a non-2xx (an object detail) and rethrow a fetch rejection untouched", async () => {
  const bad = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => null,
    fetch: (async () => Response.json({ detail: { code: "audio_too_large", message: "x" } }, { status: 413 })) as typeof fetch,
  });
  const result = await bad.uploadBytes("/up", new Uint8Array(1), "audio/mp4");
  assert.equal(result.response.status, 413);
  assert.deepEqual(result.error, { detail: { code: "audio_too_large", message: "x" } });

  const offline = createOaklyClient({
    baseUrl: "http://x",
    getAccessToken: () => null,
    fetch: (async () => {
      throw new TypeError("Network request failed");
    }) as typeof fetch,
  });
  await assert.rejects(offline.uploadBytes("/up", new Uint8Array(1), "audio/mp4"), TypeError);
});
