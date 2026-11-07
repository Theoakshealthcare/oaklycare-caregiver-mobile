import { createOaklyClient } from "@oakly/api-client";

import { createSession, type SessionTokens, type TokenStorage } from "../src/auth/session";

const OLD: SessionTokens = { accessToken: "access-old", refreshToken: "refresh-old" };
const NEW: SessionTokens = { accessToken: "access-new", refreshToken: "refresh-new" };

function memoryStorage(initial: SessionTokens | null = null) {
  let saved = initial;
  const storage: TokenStorage & { current: () => SessionTokens | null } = {
    load: jest.fn(async () => saved),
    save: jest.fn(async (t: SessionTokens) => {
      saved = t;
    }),
    clear: jest.fn(async () => {
      saved = null;
    }),
    current: () => saved,
  };
  return storage;
}

describe("session state machine", () => {
  it("starts restoring, then signedOut when nothing is stored", async () => {
    const session = createSession({ storage: memoryStorage(), refreshRequest: jest.fn() });
    expect(session.store.getState().status).toBe("restoring");
    await session.restore();
    expect(session.store.getState()).toEqual({ status: "signedOut", tokens: null, returning: false });
    expect(session.getAccessToken()).toBeNull();
  });

  it("remembers a device that has signed in, so sign-out is not a fresh install (DP1-12)", async () => {
    let returning = false;
    const storage = { ...memoryStorage(), loadReturning: async () => returning, markReturning: async () => { returning = true; } };
    const first = createSession({ storage, refreshRequest: jest.fn() });
    await first.restore();
    expect(first.store.getState().returning).toBe(false);
    await first.signIn(OLD);
    await first.signOut();
    expect(first.store.getState()).toEqual({ status: "signedOut", tokens: null, returning: true });
    // A cold start after logging out: nothing stored, but this device is known.
    const second = createSession({ storage, refreshRequest: jest.fn() });
    await second.restore();
    expect(second.store.getState()).toEqual({ status: "signedOut", tokens: null, returning: true });
  });

  it("restores stored tokens as signedIn", async () => {
    const session = createSession({ storage: memoryStorage(OLD), refreshRequest: jest.fn() });
    await session.restore();
    expect(session.store.getState().status).toBe("signedIn");
    expect(session.getAccessToken()).toBe("access-old");
  });

  it("treats an unreadable keychain as signedOut instead of crashing", async () => {
    const storage = memoryStorage(OLD);
    storage.load = jest.fn(async () => {
      throw new Error("keychain unavailable");
    });
    const session = createSession({ storage, refreshRequest: jest.fn() });
    await session.restore();
    expect(session.store.getState().status).toBe("signedOut");
  });

  it("signIn stores tokens in the keychain", async () => {
    const storage = memoryStorage();
    const session = createSession({ storage, refreshRequest: jest.fn() });
    await session.signIn(OLD);
    expect(session.store.getState().status).toBe("signedIn");
    expect(storage.current()).toEqual(OLD);
  });

  it("signOut clears memory and keychain and notifies", async () => {
    const storage = memoryStorage(OLD);
    const onSignedOut = jest.fn();
    const session = createSession({ storage, refreshRequest: jest.fn(), onSignedOut });
    await session.restore();
    await session.signOut();
    expect(session.store.getState()).toEqual({ status: "signedOut", tokens: null, returning: true });
    expect(storage.current()).toBeNull();
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  describe("refresh", () => {
    it("is single-flight: concurrent callers share one request and one result", async () => {
      const storage = memoryStorage(OLD);
      let release: (t: SessionTokens) => void = () => {};
      const refreshRequest = jest.fn(
        () =>
          new Promise<SessionTokens | null>((resolve) => {
            release = resolve;
          }),
      );
      const session = createSession({ storage, refreshRequest });
      await session.restore();

      const results = [session.refresh(), session.refresh(), session.refresh()];
      expect(refreshRequest).toHaveBeenCalledTimes(1);
      expect(refreshRequest).toHaveBeenCalledWith("refresh-old");
      release(NEW);

      expect(await Promise.all(results)).toEqual(["access-new", "access-new", "access-new"]);
      expect(storage.current()).toEqual(NEW);
      expect(session.getAccessToken()).toBe("access-new");

      // The flight is over: the next 401 starts a fresh refresh with the rotated token.
      refreshRequest.mockResolvedValueOnce({ accessToken: "access-3", refreshToken: "refresh-3" });
      expect(await session.refresh()).toBe("access-3");
      expect(refreshRequest).toHaveBeenCalledTimes(2);
      expect(refreshRequest).toHaveBeenLastCalledWith("refresh-new");
    });

    it("signs out when the server rejects the refresh token", async () => {
      const storage = memoryStorage(OLD);
      const onSignedOut = jest.fn();
      const session = createSession({ storage, refreshRequest: jest.fn(async () => null), onSignedOut });
      await session.restore();
      expect(await session.refresh()).toBeNull();
      expect(session.store.getState().status).toBe("signedOut");
      expect(storage.current()).toBeNull();
      expect(onSignedOut).toHaveBeenCalledTimes(1);
    });

    it("keeps the session when the refresh could not be made (offline)", async () => {
      const storage = memoryStorage(OLD);
      const session = createSession({
        storage,
        refreshRequest: jest.fn(async () => {
          throw new TypeError("Network request failed");
        }),
      });
      await session.restore();
      expect(await session.refresh()).toBeNull();
      expect(session.store.getState().status).toBe("signedIn");
      expect(storage.current()).toEqual(OLD);
    });

    it("does nothing when signed out", async () => {
      const refreshRequest = jest.fn();
      const session = createSession({ storage: memoryStorage(), refreshRequest });
      await session.restore();
      expect(await session.refresh()).toBeNull();
      expect(refreshRequest).not.toHaveBeenCalled();
    });

    it("a sign-out during the flight wins over the refreshed tokens", async () => {
      const storage = memoryStorage(OLD);
      let release: (t: SessionTokens) => void = () => {};
      const session = createSession({
        storage,
        refreshRequest: () =>
          new Promise<SessionTokens | null>((resolve) => {
            release = resolve;
          }),
      });
      await session.restore();
      const pending = session.refresh();
      await session.signOut();
      release(NEW);
      expect(await pending).toBeNull();
      expect(session.store.getState().status).toBe("signedOut");
      expect(storage.current()).toBeNull();
    });
  });

  describe("with the typed client", () => {
    it("parallel 401s cost one POST /auth/refresh, and every call is retried with the new token", async () => {
      // The refresh takes a moment, so all three 401s land while it is in flight.
      const refreshRequest = jest.fn(
        () => new Promise<SessionTokens>((resolve) => setTimeout(() => resolve(NEW), 20)),
      );
      const session = createSession({ storage: memoryStorage(OLD), refreshRequest });
      await session.restore();

      let refreshes = 0;
      const seen: string[] = [];
      const fakeFetch = async (input: Request | string | URL, init?: RequestInit) => {
        const req = input instanceof Request ? input : new Request(input, init);
        const auth = req.headers.get("Authorization");
        seen.push(`${new URL(req.url).pathname} ${auth}`);
        if (auth === "Bearer access-old") {
          return new Response(JSON.stringify({ detail: "Could not validate credentials" }), { status: 401 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      };
      const api = createOaklyClient({
        baseUrl: "http://api.test",
        getAccessToken: () => session.getAccessToken(),
        onUnauthorized: () => {
          refreshes += 1;
          return session.refresh();
        },
        fetch: fakeFetch as typeof fetch,
      });

      const responses = await Promise.all([
        api.GET("/api/v1/booking/caregiver/bookings", { params: { query: { status: "accepted" } } }),
        api.GET("/api/v1/booking/caregiver/bookings", { params: { query: { status: "completed" } } }),
        api.GET("/api/v1/booking/caregiver/bookings", { params: { query: { status: "new_requests" } } }),
      ]);

      expect(responses.map((r) => r.response.status)).toEqual([200, 200, 200]);
      // The client asked for a refresh three times; the session served them from ONE request.
      expect(refreshes).toBe(3);
      expect(refreshRequest).toHaveBeenCalledTimes(1);
      expect(seen.filter((s) => s.endsWith("Bearer access-new"))).toHaveLength(3);
    });
  });
});

describe("refresh racing a change of user", () => {
  const OTHER: SessionTokens = { accessToken: "access-other", refreshToken: "refresh-other" };

  it("does not overwrite a different user's tokens with an earlier user's refresh result", async () => {
    let resolveRefresh: (t: SessionTokens | null) => void = () => {};
    const storage = memoryStorage(OLD);
    const session = createSession({
      storage,
      refreshRequest: jest.fn(() => new Promise<SessionTokens | null>((r) => (resolveRefresh = r))),
    });
    await session.restore();
    const pending = session.refresh();
    await session.signOut();
    await session.signIn(OTHER); // someone else signs in while the old refresh is in flight
    resolveRefresh(NEW);
    expect(await pending).toBeNull();
    expect(session.getAccessToken()).toBe("access-other");
    expect(storage.current()).toEqual(OTHER);
  });

  it("does not sign out a different user when an earlier user's refresh is rejected", async () => {
    let resolveRefresh: (t: SessionTokens | null) => void = () => {};
    const session = createSession({
      storage: memoryStorage(OLD),
      refreshRequest: jest.fn(() => new Promise<SessionTokens | null>((r) => (resolveRefresh = r))),
    });
    await session.restore();
    const pending = session.refresh();
    await session.signOut();
    await session.signIn(OTHER);
    resolveRefresh(null); // the old refresh token was rejected
    await pending;
    expect(session.store.getState().status).toBe("signedIn");
    expect(session.getAccessToken()).toBe("access-other");
  });
});
