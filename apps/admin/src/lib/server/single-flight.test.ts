// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { singleFlight, _resetSingleFlight } from "./single-flight";

beforeEach(() => {
  vi.useFakeTimers();
  _resetSingleFlight();
});
afterEach(() => vi.useRealTimers());

describe("singleFlight", () => {
  it("runs once for concurrent callers with the same key and shares the result", async () => {
    let release!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => (release = r)));
    const calls = [singleFlight("k", fn), singleFlight("k", fn), singleFlight("k", fn)];
    expect(fn).toHaveBeenCalledTimes(1);
    release("done");
    expect(await Promise.all(calls)).toEqual(["done", "done", "done"]);
  });

  it("runs separately for different keys", async () => {
    const fn = vi.fn(async () => "x");
    await Promise.all([singleFlight("a", fn), singleFlight("b", fn)]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("serves a caller that arrives just after completion with the old key (cookie not yet updated)", async () => {
    const fn = vi.fn(async () => "first");
    await singleFlight("k", fn, { graceMs: 5_000 });
    vi.advanceTimersByTime(1_000);
    expect(await singleFlight("k", fn, { graceMs: 5_000 })).toBe("first");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs again once the grace window has passed", async () => {
    const fn = vi.fn(async () => "x");
    await singleFlight("k", fn, { graceMs: 5_000 });
    vi.advanceTimersByTime(5_001);
    await singleFlight("k", fn, { graceMs: 5_000 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not keep a result the caller says is not reusable (network failure)", async () => {
    const fn = vi.fn(async () => "fail");
    await singleFlight("k", fn, { graceMs: 5_000, reusable: () => false });
    await singleFlight("k", fn, { graceMs: 5_000, reusable: () => false });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not cache a rejection", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    await expect(singleFlight("k", fn, { graceMs: 5_000 })).rejects.toThrow("boom");
    expect(await singleFlight("k", fn, { graceMs: 5_000 })).toBe("ok");
  });
});
