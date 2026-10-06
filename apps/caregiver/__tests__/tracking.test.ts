import {
  decideTracking,
  distanceMeters,
  hasActiveVisit,
  shouldSendForeground,
  type Fix,
  type TrackingInput,
} from "../src/supply/tracking";

const base: TrackingInput = {
  profileStatus: "approved",
  isAvailable: false,
  todayVisitStatuses: [],
  foregroundGranted: true,
  backgroundGranted: true,
};

describe("decideTracking", () => {
  it.each<[string, Partial<TrackingInput>, string]>([
    ["unavailable, no visit", {}, "off"],
    ["available, no visit: foreground only", { isAvailable: true }, "foreground"],
    ["available, no visit, Always granted: still foreground (background is for visits)", { isAvailable: true, backgroundGranted: true }, "foreground"],
    ["accepted visit today", { todayVisitStatuses: ["accepted"] }, "background"],
    ["en route", { todayVisitStatuses: ["en_route"] }, "background"],
    ["in progress", { todayVisitStatuses: ["in_progress"] }, "background"],
    ["visit while available", { isAvailable: true, todayVisitStatuses: ["in_progress"] }, "background"],
    ["visit but Always not granted: foreground fallback", { todayVisitStatuses: ["en_route"], backgroundGranted: false }, "foreground"],
    ["visit completed (no longer in today's list)", { todayVisitStatuses: [] }, "off"],
    ["only a completed/cancelled status", { todayVisitStatuses: ["completed", "cancelled"] }, "off"],
    ["no foreground permission: nothing can run", { isAvailable: true, foregroundGranted: false }, "off"],
    ["no foreground permission, visit active", { todayVisitStatuses: ["en_route"], foregroundGranted: false }, "off"],
    ["not approved (suspended) even when flagged available", { profileStatus: "suspended", isAvailable: true }, "off"],
    ["not approved, visit active", { profileStatus: "under_review", todayVisitStatuses: ["en_route"] }, "off"],
  ])("%s -> %s", (_name, patch, expected) => {
    expect(decideTracking({ ...base, ...patch })).toBe(expected);
  });

  it("stops when the last visit is completed and the caregiver is unavailable, and keeps foreground if available", () => {
    const during = decideTracking({ ...base, isAvailable: true, todayVisitStatuses: ["in_progress"] });
    const afterUnavailable = decideTracking({ ...base, isAvailable: false, todayVisitStatuses: [] });
    const afterAvailable = decideTracking({ ...base, isAvailable: true, todayVisitStatuses: [] });
    expect([during, afterUnavailable, afterAvailable]).toEqual(["background", "off", "foreground"]);
  });

  it("hasActiveVisit only counts accepted / en_route / in_progress", () => {
    expect(hasActiveVisit(["completed", "cancelled", "pending"])).toBe(false);
    expect(hasActiveVisit(["completed", "accepted"])).toBe(true);
  });
});

describe("shouldSendForeground (60 s or 100 m)", () => {
  const origin: Fix = { latitude: 6.4474, longitude: 3.4723, timestamp: 1_000_000 };
  // 0.001 degrees of latitude is about 111 m.
  const farLat = 6.4474 + 0.001;
  const nearLat = 6.4474 + 0.0005; // about 55 m

  it("always sends the first fix", () => {
    expect(shouldSendForeground(null, origin)).toBe(true);
  });

  it("does not send a nearby fix inside 60 s", () => {
    expect(shouldSendForeground(origin, { latitude: nearLat, longitude: 3.4723, timestamp: origin.timestamp + 30_000 })).toBe(false);
  });

  it("sends once 60 s have passed even when standing still", () => {
    expect(shouldSendForeground(origin, { ...origin, timestamp: origin.timestamp + 60_000 })).toBe(true);
    expect(shouldSendForeground(origin, { ...origin, timestamp: origin.timestamp + 59_999 })).toBe(false);
  });

  it("sends immediately after moving more than 100 m", () => {
    expect(shouldSendForeground(origin, { latitude: farLat, longitude: 3.4723, timestamp: origin.timestamp + 5_000 })).toBe(true);
  });

  it("distance is metres", () => {
    const d = distanceMeters(origin, { latitude: farLat, longitude: 3.4723 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });
});
