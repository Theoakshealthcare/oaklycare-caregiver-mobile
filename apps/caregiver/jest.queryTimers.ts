import { timeoutManager } from "@tanstack/react-query";

// React Query keeps a gc timer (5 minutes by default) for every query and mutation that no screen observes any
// more. Tests create many query clients (and App.test uses the app's own) and never reach those timers, so under a
// single-worker run (`--runInBand`, which is how CI and `--detectOpenHandles` run) the Jest process stayed alive
// for the 5 minutes after the last test had passed ("Jest did not exit one second after the test run").
//
// Hand React Query a timer provider that remembers what it armed, and cancel whatever is still pending when each
// test ends. The next test starts from a fresh client anyway; a timer left over is never something a test waits on.
// The wrappers resolve the global timer functions at call time, so tests that install fake timers still drive them.
const pending = new Set<ReturnType<typeof setTimeout>>();

timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => {
    const id = setTimeout(() => {
      pending.delete(id);
      callback();
    }, delay);
    pending.add(id);
    return id as unknown as number;
  },
  clearTimeout: (id) => {
    pending.delete(id as unknown as ReturnType<typeof setTimeout>);
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  },
  // React Query's own gc/refetch intervals; the same cleanup applies.
  setInterval: (callback, delay) => setInterval(callback, delay) as unknown as number,
  clearInterval: (id) => clearInterval(id as unknown as ReturnType<typeof setInterval>),
});

function cancelPending() {
  for (const id of pending) clearTimeout(id);
  pending.clear();
}

afterEach(cancelPending);

// Testing Library unmounts the rendered screen in its own `afterEach`, which can run after the hook above, and the
// unmount is what arms the gc timer of every query the screen was watching. So sweep once more when the file ends,
// after a tick for calls that settle while the last screen unmounts.
afterAll(async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  cancelPending();
});
