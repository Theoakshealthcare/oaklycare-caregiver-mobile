import { parseJobOffer, registerForPush, type PushRegistrationDeps } from "../src/push/registration";
import { resolveOffer } from "../src/push/openOffer";
import type { CaregiverHome } from "../src/supply/locationService";

function makeDeps(overrides: Partial<PushRegistrationDeps> = {}) {
  const log: string[] = [];
  const registered: Array<[string, string]> = [];
  const forgotten: string[] = [];
  let stored: string | null = null;
  const deps: PushRegistrationDeps = {
    isDevice: true,
    platform: "ios",
    projectId: "11111111-1111-4111-8111-111111111111",
    ensurePermission: async () => true,
    getExpoPushToken: async () => "ExponentPushToken[placeholder-aaa]",
    storedToken: async () => stored,
    storeToken: async (token) => {
      stored = token;
    },
    register: async (token, platform) => {
      registered.push([token, platform]);
    },
    forget: async (token) => {
      forgotten.push(token);
    },
    log: (message) => log.push(message),
    ...overrides,
  };
  return { deps, log, registered, forgotten, getStored: () => stored, setStored: (t: string | null) => (stored = t) };
}

describe("registerForPush skip paths (no crash, a dev log, nothing sent)", () => {
  it("skips on a simulator / non-device", async () => {
    const t = makeDeps({ isDevice: false });
    await expect(registerForPush(t.deps)).resolves.toEqual({ status: "skipped", reason: "not_a_device" });
    expect(t.registered).toEqual([]);
    expect(t.log[0]).toContain("physical device");
  });

  it("skips when there is no EAS projectId", async () => {
    const t = makeDeps({ projectId: undefined });
    await expect(registerForPush(t.deps)).resolves.toEqual({ status: "skipped", reason: "no_project_id" });
    expect(t.registered).toEqual([]);
    expect(t.log[0]).toContain("projectId");
  });

  it("skips when notification permission is refused", async () => {
    const t = makeDeps({ ensurePermission: async () => false });
    await expect(registerForPush(t.deps)).resolves.toEqual({ status: "skipped", reason: "permission_denied" });
    expect(t.registered).toEqual([]);
  });

  it("does not get a token at all when it would skip", async () => {
    const getExpoPushToken = jest.fn(async () => "ExponentPushToken[x]");
    await registerForPush(makeDeps({ projectId: undefined, getExpoPushToken }).deps);
    await registerForPush(makeDeps({ isDevice: false, getExpoPushToken }).deps);
    expect(getExpoPushToken).not.toHaveBeenCalled();
  });

  it("a failing token request or backend call is a 'failed' result, not a throw, and stores nothing", async () => {
    const t = makeDeps({
      register: async () => {
        throw new Error("503");
      },
    });
    await expect(registerForPush(t.deps)).resolves.toEqual({ status: "failed" });
    expect(t.getStored()).toBeNull();
    expect(t.log[0]).toContain("registration failed");

    const u = makeDeps({
      getExpoPushToken: async () => {
        throw new Error("no APNs credentials");
      },
    });
    await expect(registerForPush(u.deps)).resolves.toEqual({ status: "failed" });
  });
});

describe("registerForPush on a device with an EAS project", () => {
  it("registers the token with the platform and stores it under the secure-store key's setter", async () => {
    const t = makeDeps();
    await expect(registerForPush(t.deps)).resolves.toEqual({
      status: "registered",
      token: "ExponentPushToken[placeholder-aaa]",
      replaced: null,
    });
    expect(t.registered).toEqual([["ExponentPushToken[placeholder-aaa]", "ios"]]);
    expect(t.getStored()).toBe("ExponentPushToken[placeholder-aaa]");
    expect(t.forgotten).toEqual([]);
  });

  it("an unchanged token is re-posted (idempotent upsert) and nothing is deleted", async () => {
    const t = makeDeps();
    t.setStored("ExponentPushToken[placeholder-aaa]");
    const result = await registerForPush(t.deps);
    expect(result).toMatchObject({ status: "registered", replaced: null });
    expect(t.registered).toHaveLength(1);
    expect(t.forgotten).toEqual([]);
  });

  it("a changed token is registered, stored, and the old one is forgotten", async () => {
    const t = makeDeps({ getExpoPushToken: async () => "ExponentPushToken[placeholder-bbb]" });
    t.setStored("ExponentPushToken[placeholder-aaa]");
    const result = await registerForPush(t.deps);
    expect(result).toEqual({
      status: "registered",
      token: "ExponentPushToken[placeholder-bbb]",
      replaced: "ExponentPushToken[placeholder-aaa]",
    });
    expect(t.registered).toEqual([["ExponentPushToken[placeholder-bbb]", "ios"]]);
    expect(t.getStored()).toBe("ExponentPushToken[placeholder-bbb]");
    expect(t.forgotten).toEqual(["ExponentPushToken[placeholder-aaa]"]);
  });

  it("failing to forget the old token does not fail the registration", async () => {
    const t = makeDeps({
      getExpoPushToken: async () => "ExponentPushToken[placeholder-bbb]",
      forget: async () => {
        throw new Error("offline");
      },
    });
    t.setStored("ExponentPushToken[placeholder-aaa]");
    await expect(registerForPush(t.deps)).resolves.toMatchObject({ status: "registered" });
  });

  it("sends android as the platform on android", async () => {
    const t = makeDeps({ platform: "android" });
    await registerForPush(t.deps);
    expect(t.registered[0]?.[1]).toBe("android");
  });
});

describe("parseJobOffer (guide, section 6: data.type routes, booking_id opens the offer)", () => {
  it("accepts the captured job-offer payload", () => {
    expect(
      parseJobOffer({
        type: "job_offer",
        booking_id: "1b4b008b-c4d2-4fb1-a7b6-1eca61375802",
        area: "Lagos",
        scheduled_at: "2026-10-06T08:38:27.858997Z",
      }),
    ).toEqual({ bookingId: "1b4b008b-c4d2-4fb1-a7b6-1eca61375802" });
  });

  it.each([null, undefined, "job_offer", {}, { type: "chat", booking_id: "x" }, { type: "job_offer" }, { type: "job_offer", booking_id: 7 }, { type: "job_offer", booking_id: "" }])(
    "ignores %p",
    (data) => {
      expect(parseJobOffer(data)).toBeNull();
    },
  );
});

describe("resolveOffer (the offer view comes from home open_offers)", () => {
  const home = (offers: CaregiverHome["open_offers"]): CaregiverHome => ({
    profile_status: "approved",
    is_available: true,
    location_updated_at: null,
    today_visits: [],
    upcoming_visits: [],
    open_offers: offers,
    wallet_balance_naira: 0,
    can_author_care_plans: false,
    currency: "NGN",
  });
  const offer = {
    booking_id: "1b4b008b-c4d2-4fb1-a7b6-1eca61375802",
    service_type: "nurse",
    scheduled_date: "2026-10-06T08:38:27.858997",
    scheduled_end_date: "2026-10-06T10:38:27.858997",
    duration_hours: 2,
    area: "Lagos",
    state: "Lagos",
    offered_at: "2026-10-06T08:23:27.927274",
  };

  it("maps a matching open offer", async () => {
    await expect(resolveOffer(offer.booking_id, async () => home([offer]))).resolves.toEqual({
      id: offer.booking_id,
      serviceType: "nurse",
      assistanceType: null,
      durationHours: 2,
      scheduledDate: offer.scheduled_date,
      scheduledEndDate: offer.scheduled_end_date,
      area: "Lagos, Lagos",
    });
  });

  it("is null when the offer was taken or expired, or home cannot be loaded", async () => {
    await expect(resolveOffer("someone-else", async () => home([offer]))).resolves.toBeNull();
    await expect(
      resolveOffer(offer.booking_id, async () => {
        throw new Error("offline");
      }),
    ).resolves.toBeNull();
  });
});
