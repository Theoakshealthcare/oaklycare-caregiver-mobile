/**
 * The seam between the identity screens and whatever captures the ID and the selfie. The screens know only this
 * interface: slice K7b puts the verification partner's widget behind it (WebView and camera permission); K7a ships a
 * simulated one for `mock` mode and a placeholder for `api` mode.
 *
 * The outcome is a HINT. It is sent to the backend as a client event and never decides the result.
 */
import type { IdentityWidgetConfig } from "./identityModel";
import { KYC_MODE } from "./config";
import { createMockWidgetLauncher } from "./mockIdentityService";

export type WidgetOutcome =
  | { kind: "completed"; sessionId?: string }
  | { kind: "closed" }
  | { kind: "error" }
  /** The camera permission was refused (design 11.3, state 2). */
  | { kind: "permissionDenied" };

export interface IdentityWidgetLauncher {
  /** Opens the capture UI with the config the server gave, resolves when the person leaves it. Never rejects by contract. */
  open(config: IdentityWidgetConfig): Promise<WidgetOutcome>;
}

/** `api` mode before K7b: there is no widget to open, so this reports an error and changes nothing. */
export const unavailableWidgetLauncher: IdentityWidgetLauncher = {
  open: async () => ({ kind: "error" }),
};

let launcher: IdentityWidgetLauncher = KYC_MODE === "mock" ? createMockWidgetLauncher() : unavailableWidgetLauncher;

export function getWidgetLauncher(): IdentityWidgetLauncher {
  return launcher;
}

/** K7b installs the real launcher here; tests install their own. */
export function setWidgetLauncher(next: IdentityWidgetLauncher): void {
  launcher = next;
}
