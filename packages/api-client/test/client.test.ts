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
