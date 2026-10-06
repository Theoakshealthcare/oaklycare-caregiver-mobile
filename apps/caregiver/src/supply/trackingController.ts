/**
 * Applies the tracking mode (off / foreground / background) one change at a time.
 *
 * Starting and stopping location updates are async native calls. Applied naively from a React
 * effect, a sign-out or a quick mode change during one of those awaits could start a watcher
 * after cleanup already ran, leaving GPS on with nothing able to stop it. Here every change
 * runs after the previous one finishes, re-checks after each await that it is still the latest
 * request, and `dispose()` stops everything for good.
 */
import type { TrackingMode } from "./tracking";

export interface TrackingControllerDeps {
  foreground: { start: () => Promise<void>; stop: () => void };
  startVisit: () => Promise<void>;
  stopVisit: () => Promise<void>;
}

export function createTrackingController(deps: TrackingControllerDeps) {
  let queue: Promise<void> = Promise.resolve();
  let latest = 0;
  let disposed = false;

  function enqueue(step: () => Promise<void>): Promise<void> {
    queue = queue.then(step, step);
    return queue;
  }

  async function stopAll(): Promise<void> {
    deps.foreground.stop();
    await deps.stopVisit();
  }

  return {
    apply(mode: TrackingMode): Promise<void> {
      if (disposed) return queue;
      const ticket = ++latest;
      const current = () => !disposed && ticket === latest;
      return enqueue(async () => {
        if (!current()) return; // superseded before it started
        if (mode === "background") {
          deps.foreground.stop();
          if (current()) await deps.startVisit();
        } else if (mode === "foreground") {
          await deps.stopVisit();
          if (current()) await deps.foreground.start();
          if (!current()) deps.foreground.stop(); // superseded while starting
        } else {
          await stopAll();
        }
      });
    },

    dispose(): Promise<void> {
      disposed = true;
      deps.foreground.stop(); // stop now, then again after any in-flight step finishes
      return enqueue(stopAll);
    },
  };
}
