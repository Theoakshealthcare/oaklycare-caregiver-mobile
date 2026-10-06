/**
 * Every location ping path must omit `is_available`: an omitted flag leaves the switch alone on the
 * backend, anything else could silently flip it (guide, section 5).
 */
import * as TaskManager from "expo-task-manager";

import "../src/supply/backgroundLocationTask";

import { session } from "../src/auth";
import { coordsFromLocation } from "../src/supply/coords";
import { createForegroundTracker } from "../src/supply/foregroundTracker";
import { buildPing, locationService, type Coords } from "../src/supply/locationService";

const fix: Coords = { latitude: 6.4494, longitude: 3.4723, accuracy: 10, heading: -1, speed: -1 };

// The app's client captures `fetch` when it is created, so route it through a late-bound wrapper.
jest.mock("../src/api/client", () => {
  const { createOaklyClient } = jest.requireActual("@oakly/api-client");
  return {
    api: createOaklyClient({
      baseUrl: "http://test.local",
      getAccessToken: () => "access",
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    }),
  };
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const locationBody = {
  id: "00000000-0000-4000-8000-000000000001",
  caregiver_id: "00000000-0000-4000-8000-000000000002",
  latitude: 6.4494,
  longitude: 3.4723,
  accuracy: 10,
  is_active: true,
  is_available: false,
  recorded_at: "2026-10-06T08:23:25.625960",
};

let fetchSpy: jest.SpyInstance;
const sentBodies: Record<string, unknown>[] = [];

beforeEach(() => {
  sentBodies.length = 0;
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    sentBodies.push((await request.json()) as Record<string, unknown>);
    return jsonResponse(locationBody);
  });
});

afterEach(() => fetchSpy.mockRestore());

describe("location pings never include is_available", () => {
  it("buildPing drops unknown (-1) readings and has no availability key", () => {
    const body = buildPing(fix);
    expect(body).toEqual({ latitude: 6.4494, longitude: 3.4723, accuracy: 10 });
    expect("is_available" in body).toBe(false);
  });

  it("locationService.ping posts a body without is_available", async () => {
    await locationService.ping(fix);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = fetchSpy.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain("/api/v1/booking/caregiver/location");
    expect(request.method).toBe("POST");
    expect(Object.keys(sentBodies[0] ?? {})).not.toContain("is_available");
  });

  it("the foreground tracker sends through the same body builder", async () => {
    let emit: (f: Coords & { timestamp: number }) => void = () => undefined;
    const tracker = createForegroundTracker({
      watch: async (onFix) => {
        emit = onFix;
        return () => undefined;
      },
      getCurrent: async () => null,
      send: (coords) => locationService.ping(coords),
    });
    await tracker.start();
    emit({ ...fix, timestamp: 1 });
    await new Promise<void>((resolve) => setImmediate(resolve));
    tracker.stop();
    expect(sentBodies).toHaveLength(1);
    expect(Object.keys(sentBodies[0] ?? {})).not.toContain("is_available");
  });

  it("the background task body pings without is_available (and restores the session when started headless)", async () => {
    const define = TaskManager.defineTask as jest.Mock;
    const [name, executor] = define.mock.calls[0] as [string, (body: unknown) => Promise<void>];
    expect(name).toBe("oakly-visit-location");

    await session.signIn({ accessToken: "access", refreshToken: "refresh" });
    await executor({
      data: {
        locations: [
          { coords: { latitude: 1, longitude: 2, accuracy: 5, heading: -1, speed: 0 }, timestamp: 1 },
          { coords: { latitude: 6.4494, longitude: 3.4723, accuracy: 8, heading: 90, speed: 1.5 }, timestamp: 2 },
        ],
      },
      error: null,
    });
    await session.signOut();

    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0]).toEqual({ latitude: 6.4494, longitude: 3.4723, accuracy: 8, heading: 90, speed: 1.5 });
  });

  it("the background task sends nothing and stops itself when signed out", async () => {
    const [, executor] = (TaskManager.defineTask as jest.Mock).mock.calls[0] as [string, (body: unknown) => Promise<void>];
    await session.signOut();
    await executor({
      data: { locations: [{ coords: { latitude: 1, longitude: 2, accuracy: 5, heading: 0, speed: 0 }, timestamp: 1 }] },
      error: null,
    });
    expect(sentBodies).toHaveLength(0);
  });

  it("coordsFromLocation maps the expo-location object", () => {
    expect(
      coordsFromLocation({
        coords: { latitude: 1, longitude: 2, accuracy: 3, altitude: 0, altitudeAccuracy: 0, heading: 4, speed: 5 },
        timestamp: 0,
      }),
    ).toEqual({ latitude: 1, longitude: 2, accuracy: 3, heading: 4, speed: 5 });
  });
});

describe("foreground tracker cadence", () => {
  it("throttles by the 60 s / 100 m rule and retries a dropped ping immediately", async () => {
    const sends: Coords[] = [];
    let fail = false;
    let emit: (f: Coords & { timestamp: number }) => void = () => undefined;
    const tracker = createForegroundTracker({
      watch: async (onFix) => {
        emit = onFix;
        return () => undefined;
      },
      getCurrent: async () => null,
      send: async (coords) => {
        if (fail) throw new Error("offline");
        sends.push(coords);
      },
    });
    await tracker.start();
    const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

    emit({ ...fix, timestamp: 0 });
    await flush();
    emit({ ...fix, timestamp: 30_000 }); // too soon, same place
    await flush();
    expect(sends).toHaveLength(1);

    emit({ ...fix, latitude: fix.latitude + 0.002, timestamp: 31_000 }); // moved > 100 m
    await flush();
    expect(sends).toHaveLength(2);

    fail = true;
    emit({ ...fix, timestamp: 100_000 }); // 60 s since the last send, but it fails
    await flush();
    fail = false;
    emit({ ...fix, timestamp: 101_000 }); // retried at once because the failed send was not counted
    await flush();
    expect(sends).toHaveLength(3);
    tracker.stop();
    expect(tracker.isRunning()).toBe(false);
  });
});
