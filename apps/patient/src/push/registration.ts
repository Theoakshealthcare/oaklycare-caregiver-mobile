/**
 * Expo push token registration. All native access is injected, so every skip path is testable. Copied from the caregiver app.
 *
 * A push is only a nudge (the feed is the source of truth): nothing here may crash or block sign-in, and a missing EAS
 * project or a simulator is a normal development situation, not an error.
 */
export type PushPlatform = "ios" | "android";

export interface PushRegistrationDeps {
  isDevice: boolean;
  platform: PushPlatform;
  /** `Constants.expoConfig?.extra?.eas?.projectId`; absent until the owner has run `eas init` for the patient app. */
  projectId: string | undefined;
  /** Asks for notification permission (OS prompt when undetermined). True when granted. */
  ensurePermission(): Promise<boolean>;
  getExpoPushToken(projectId: string): Promise<string>;
  /** The token last registered from this device (`oakly.push_token` in secure store). */
  storedToken(): Promise<string | null>;
  storeToken(token: string): Promise<void>;
  register(token: string, platform: PushPlatform): Promise<unknown>;
  forget(token: string): Promise<unknown>;
  log(message: string): void;
}

export type PushRegistrationResult =
  | { status: "registered"; token: string; replaced: string | null }
  | { status: "skipped"; reason: "not_a_device" | "no_project_id" | "permission_denied" }
  | { status: "failed" };

export async function registerForPush(deps: PushRegistrationDeps): Promise<PushRegistrationResult> {
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
    const token = await deps.getExpoPushToken(deps.projectId);
    const previous = await deps.storedToken();
    // Always POST: it is an idempotent upsert, and it heals a token the backend pruned as dead.
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
