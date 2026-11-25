/**
 * Expo push token registration. All native access is injected, so every skip path is testable.
 *
 * A push is only a hint (backend guide, section 14.9): nothing here may crash or block sign-in,
 * and a missing EAS project or a simulator is a normal development situation, not an error.
 */
export type PushPlatform = "ios" | "android";

export interface PushRegistrationDeps {
  isDevice: boolean;
  platform: PushPlatform;
  /** `Constants.expoConfig?.extra?.eas?.projectId`; absent until an EAS project exists. */
  projectId: string | undefined;
  /** Asks for notification permission (OS prompt when undetermined). True when granted. */
  ensurePermission(): Promise<boolean>;
  /** `deviceToken` is the native token an OS "token changed" event carried: passing it stops Expo asking the OS again. */
  getExpoPushToken(projectId: string, deviceToken?: string): Promise<string>;
  /** The token last registered from this device (`oakly.push_token` in secure store). */
  storedToken(): Promise<string | null>;
  storeToken(token: string): Promise<void>;
  register(token: string, platform: PushPlatform): Promise<unknown>;
  forget(token: string): Promise<unknown>;
  log(message: string): void;
}

export type PushRegistrationResult =
  | { status: "registered"; token: string; replaced: string | null }
  | { status: "unchanged"; token: string }
  | { status: "skipped"; reason: "not_a_device" | "no_project_id" | "permission_denied" }
  | { status: "failed" };

export interface PushRegistrationOptions {
  /**
   * Set only when the call answers the OS "push token changed" event, with the native token that event carried.
   * Asking the OS for a token inside that listener fires the listener again (expo-notifications documents the
   * infinite loop), so such a call never asks the OS, and sends nothing when the Expo token is already registered.
   */
  deviceToken?: string;
}

let inFlight: Promise<PushRegistrationResult> | null = null;

/** One registration at a time: a second call while one is running (the event our own request causes) joins it. */
export function registerForPush(
  deps: PushRegistrationDeps,
  options: PushRegistrationOptions = {},
): Promise<PushRegistrationResult> {
  if (!inFlight) {
    inFlight = registerOnce(deps, options).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function registerOnce(deps: PushRegistrationDeps, options: PushRegistrationOptions): Promise<PushRegistrationResult> {
  if (!deps.isDevice) {
    deps.log("[push] skipped: push tokens need a physical device (simulator or emulator)");
    return { status: "skipped", reason: "not_a_device" };
  }
  if (!deps.projectId) {
    deps.log("[push] skipped: no EAS projectId in app config (extra.eas.projectId). Run `eas init` to enable push.");
    return { status: "skipped", reason: "no_project_id" };
  }
  try {
    if (!(await deps.ensurePermission())) {
      deps.log("[push] skipped: notification permission not granted");
      return { status: "skipped", reason: "permission_denied" };
    }
    const token = await deps.getExpoPushToken(deps.projectId, options.deviceToken);
    const previous = await deps.storedToken();
    if (options.deviceToken && previous === token) return { status: "unchanged", token };
    // A normal call always POSTs: it is an idempotent upsert, and it heals a token the backend pruned as dead.
    await deps.register(token, deps.platform);
    await deps.storeToken(token);
    if (previous && previous !== token) {
      // The Expo token changed: stop the backend pushing to the old one. Best effort.
      await deps.forget(previous).catch(() => undefined);
    }
    return { status: "registered", token, replaced: previous && previous !== token ? previous : null };
  } catch (error) {
    deps.log(`[push] registration failed: ${error instanceof Error ? error.message : String(error)}`);
    return { status: "failed" };
  }
}

/** The data payload of a job-offer push (backend guide, section 6). */
export interface JobOfferNotification {
  bookingId: string;
}

/** Routes on `data.type`; anything that is not a well-formed job offer is ignored. */
export function parseJobOffer(data: unknown): JobOfferNotification | null {
  if (!data || typeof data !== "object") return null;
  const { type, booking_id: bookingId } = data as { type?: unknown; booking_id?: unknown };
  if (type !== "job_offer" || typeof bookingId !== "string" || bookingId.length === 0) return null;
  return { bookingId };
}

/** The data payload of a new-chat-message push: `{ type: "chat_message", booking_id }`. */
export function parseChatMessage(data: unknown): JobOfferNotification | null {
  if (!data || typeof data !== "object") return null;
  const { type, booking_id: bookingId } = data as { type?: unknown; booking_id?: unknown };
  if (type !== "chat_message" || typeof bookingId !== "string" || bookingId.length === 0) return null;
  return { bookingId };
}
