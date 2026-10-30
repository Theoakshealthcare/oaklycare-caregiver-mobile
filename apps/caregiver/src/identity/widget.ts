/**
 * The seam between the identity screens and whatever captures the ID and the selfie. The screens know only this
 * interface. `mock` mode uses a simulated launcher; `api` mode opens the page the backend hosts in the system browser
 * session (`browserWidgetLauncher.ts`, slice K7b), so no provider SDK or WebView lives in the app.
 *
 * The outcome is a HINT. It is sent to the backend as a client event and never decides the result.
 */
import type { IdentityWidgetConfig } from "./identityModel";
import { KYC_MODE } from "./config";
import { createBrowserWidgetLauncher } from "./browserWidgetLauncher";
import { createMockWidgetLauncher } from "./mockIdentityService";

export type WidgetOutcome =
  | { kind: "completed"; sessionId?: string }
  | { kind: "closed" }
  /**
   * The person left the browser without reaching the return page (cancel, dismiss or another browser already open).
   * Whether they finished is unknown, so this is NOT a failure: the screen waits for the server.
   */
  | { kind: "dismissed" }
  | { kind: "error" }
  /** The camera permission was refused (design 11.3, state 2). */
  | { kind: "permissionDenied" };

/** What the server gave for one attempt: the widget block, and the hosted page's URL (absent on an older backend). */
export interface IdentityWidgetLaunch {
  config: IdentityWidgetConfig;
  widgetUrl?: string;
}

export interface IdentityWidgetLauncher {
  /** Opens the capture UI the server described, resolves when the person leaves it. Never rejects by contract. */
  open(launch: IdentityWidgetLaunch): Promise<WidgetOutcome>;
}

/** Reports an error and changes nothing: for `off` mode, where no launcher is wanted, and for tests. */
export const unavailableWidgetLauncher: IdentityWidgetLauncher = {
  open: async () => ({ kind: "error" }),
};

function defaultLauncher(): IdentityWidgetLauncher {
  if (KYC_MODE === "mock") return createMockWidgetLauncher();
  if (KYC_MODE === "api") return createBrowserWidgetLauncher();
  return unavailableWidgetLauncher;
}

let launcher: IdentityWidgetLauncher = defaultLauncher();

export function getWidgetLauncher(): IdentityWidgetLauncher {
  return launcher;
}

/** Swap the launcher (dev tooling, tests). */
export function setWidgetLauncher(next: IdentityWidgetLauncher): void {
  launcher = next;
}
