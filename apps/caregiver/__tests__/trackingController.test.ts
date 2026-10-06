import { createTrackingController } from "../src/supply/trackingController";

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function fakes() {
  const state = { foreground: false, visit: false };
  const gates: { stopVisit?: ReturnType<typeof deferred> } = {};
  return {
    state,
    gates,
    foreground: {
      start: jest.fn(async () => {
        state.foreground = true;
      }),
      stop: jest.fn(() => {
        state.foreground = false;
      }),
    },
    startVisit: jest.fn(async () => {
      state.visit = true;
    }),
    stopVisit: jest.fn(async () => {
      if (gates.stopVisit) await gates.stopVisit.promise; // a slow native call
      state.visit = false;
    }),
  };
}

describe("tracking controller", () => {
  it("applies modes", async () => {
    const f = fakes();
    const c = createTrackingController(f);
    await c.apply("foreground");
    expect(f.state).toEqual({ foreground: true, visit: false });
    await c.apply("background");
    expect(f.state).toEqual({ foreground: false, visit: true });
    await c.apply("off");
    expect(f.state).toEqual({ foreground: false, visit: false });
  });

  it("dispose during a slow native call never leaves a watcher running (sign-out race)", async () => {
    const f = fakes();
    f.gates.stopVisit = deferred();
    const c = createTrackingController(f);
    const pending = c.apply("foreground"); // awaits stopVisit before starting the watcher
    const disposed = c.dispose(); // user signs out meanwhile
    f.gates.stopVisit.resolve();
    await Promise.all([pending, disposed]);
    expect(f.state).toEqual({ foreground: false, visit: false });
    expect(f.foreground.start).not.toHaveBeenCalled();
  });

  it("a quick foreground -> background switch never runs both", async () => {
    const f = fakes();
    f.gates.stopVisit = deferred();
    const c = createTrackingController(f);
    const first = c.apply("foreground");
    const second = c.apply("background");
    f.gates.stopVisit.resolve();
    await Promise.all([first, second]);
    expect(f.state).toEqual({ foreground: false, visit: true });
  });

  it("ignores apply after dispose", async () => {
    const f = fakes();
    const c = createTrackingController(f);
    await c.dispose();
    await c.apply("foreground");
    expect(f.foreground.start).not.toHaveBeenCalled();
  });
});
