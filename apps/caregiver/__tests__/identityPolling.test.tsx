import { act, renderHook } from "@testing-library/react-native";

import { useIdentityPolling } from "../src/hooks/useIdentityVerification";

describe("useIdentityPolling", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // The renderer keeps a few timers of its own; the hook's are what is counted against this baseline.
  let baseline = 0;
  beforeEach(() => {
    baseline = jest.getTimerCount();
  });
  const ours = () => jest.getTimerCount() - baseline;
  const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

  it("does nothing while no result is awaited, and leaves no timer behind", async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    await renderHook(() => useIdentityPolling(false, refetch));
    await advance(60_000);
    expect(refetch).not.toHaveBeenCalled();
    expect(ours()).toBe(0);
  });

  it("reads every 3 s at first, every 5 s after 30 s and every 10 s after 60 s", async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    await renderHook(() => useIdentityPolling(true, refetch));
    await advance(2_999);
    expect(refetch).toHaveBeenCalledTimes(0);
    await advance(1);
    expect(refetch).toHaveBeenCalledTimes(1);
    // 3 s beats until 30 s: calls at 3, 6, ... 30 s
    await advance(27_000);
    expect(refetch).toHaveBeenCalledTimes(10);
    // from 30 s on, 5 s apart until 60 s
    await advance(5_000);
    expect(refetch).toHaveBeenCalledTimes(11);
    await advance(25_000);
    expect(refetch).toHaveBeenCalledTimes(16);
    // after 60 s, 10 s apart
    await advance(10_000);
    expect(refetch).toHaveBeenCalledTimes(17);
    await advance(20_000);
    expect(refetch).toHaveBeenCalledTimes(19);
  });

  it("says it is taking longer after two minutes and stops after five, with no timer left", async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() => useIdentityPolling(true, refetch));
    await advance(100_000);
    expect(result.current.slow).toBe(false);
    await advance(30_000);
    expect(result.current.slow).toBe(true);
    expect(result.current.stopped).toBe(false);

    await advance(180_000);
    expect(result.current.stopped).toBe(true);
    const calls = refetch.mock.calls.length;
    await advance(120_000);
    expect(refetch.mock.calls.length).toBe(calls);
    expect(ours()).toBe(0);
  });

  it("starts a fresh five minutes when asked to check again", async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() => useIdentityPolling(true, refetch));
    await advance(310_000);
    expect(result.current.stopped).toBe(true);
    const before = refetch.mock.calls.length;
    await act(async () => result.current.restart());
    expect(result.current.stopped).toBe(false);
    expect(result.current.slow).toBe(false);
    await advance(3_000);
    expect(refetch.mock.calls.length).toBe(before + 1);
  });

  it("stops at once when the result is no longer awaited, and on unmount", async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = await renderHook(({ on }: { on: boolean }) => useIdentityPolling(on, refetch), {
      initialProps: { on: true },
    });
    await advance(3_000);
    expect(refetch).toHaveBeenCalledTimes(1);
    await rerender({ on: false });
    await advance(30_000);
    expect(refetch).toHaveBeenCalledTimes(1);

    await rerender({ on: true });
    await advance(3_000);
    expect(refetch).toHaveBeenCalledTimes(2);
    await unmount();
    await advance(60_000);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("keeps going when a read fails", async () => {
    const refetch = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    await renderHook(() => useIdentityPolling(true, refetch));
    await advance(3_000);
    await advance(3_000);
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
