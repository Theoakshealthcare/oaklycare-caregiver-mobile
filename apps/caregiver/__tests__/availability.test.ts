import { ApiError, messageForError } from "../src/api/errors";
import { goAvailable, goUnavailable, type AvailabilityDeps } from "../src/supply/availabilityFlow";

function makeDeps(overrides: Partial<AvailabilityDeps> = {}) {
  const calls: string[] = [];
  const deps: AvailabilityDeps = {
    ensureForegroundLocation: async () => {
      calls.push("permission");
      return true;
    },
    getPosition: async () => {
      calls.push("position");
      return { latitude: 6.4494, longitude: 3.4723, accuracy: 10 };
    },
    ping: async () => {
      calls.push("ping");
    },
    setAvailability: async (value) => {
      calls.push(`availability:${value}`);
      return { is_available: value };
    },
    ...overrides,
  };
  return { deps, calls };
}

describe("goAvailable is location-first", () => {
  it("asks permission, reads a position, pings, and only then switches on", async () => {
    const { deps, calls } = makeDeps();
    await expect(goAvailable(deps)).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["permission", "position", "ping", "availability:true"]);
  });

  it("does nothing when location permission is refused", async () => {
    const { deps, calls } = makeDeps({ ensureForegroundLocation: async () => false });
    await expect(goAvailable(deps)).resolves.toEqual({ ok: false, reason: "permission_denied" });
    expect(calls).toEqual([]);
  });

  it("does not switch on when no position could be read", async () => {
    const { deps, calls } = makeDeps({ getPosition: async () => null });
    await expect(goAvailable(deps)).resolves.toEqual({ ok: false, reason: "position_unavailable" });
    expect(calls).not.toContain("availability:true");
    expect(calls).not.toContain("ping");
  });

  it("does not switch on when the ping fails (the error propagates to be mapped)", async () => {
    const failure = new ApiError(0, null, "offline");
    const { deps, calls } = makeDeps({
      ping: async () => {
        throw failure;
      },
    });
    await expect(goAvailable(deps)).rejects.toBe(failure);
    expect(calls).not.toContain("availability:true");
  });

  it("propagates the backend's 403 / 409 from the switch", async () => {
    const notApproved = new ApiError(403, { detail: "Your account is not approved to change availability" }, "x");
    const { deps } = makeDeps({
      setAvailability: async () => {
        throw notApproved;
      },
    });
    await expect(goAvailable(deps)).rejects.toBe(notApproved);
  });

  it("going unavailable needs no location", async () => {
    const { deps, calls } = makeDeps();
    await goUnavailable(deps);
    expect(calls).toEqual(["availability:false"]);
  });
});

describe("availability error mapping (guide, section 5)", () => {
  it("403 not approved", () => {
    const error = new ApiError(403, { detail: "Your account is not approved to change availability" }, "x");
    expect(messageForError(error, "availability")).toBe(
      "You're not approved yet. You can go available once an admin approves your profile.",
    );
  });

  it("409 share your location first", () => {
    const error = new ApiError(409, { detail: "Share your location before going available" }, "x");
    expect(messageForError(error, "availability")).toBe(
      "We need your location before you can go available. Turn on location and try again.",
    );
  });

  it("a patient token and an offline phone keep their generic messages", () => {
    const patient = new ApiError(403, { detail: "Access denied. Caregiver account required." }, "x");
    expect(messageForError(patient, "availability")).toBe(
      "This app is for caregivers. Please use the correct app for your account.",
    );
    expect(messageForError(new ApiError(0, null, "x"), "availability")).toBe(
      "Can't reach Oakly. Check your internet connection and try again.",
    );
  });
});
