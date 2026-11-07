import { pushTokenStorage } from "@/src/auth/secureStorage";
import { pushService } from "@/src/services/notifications.service";

/**
 * Best-effort: tells the server to stop pushing to this device. Never blocks signing out. Kept apart from `native.ts` so
 * the auth service (and every test that signs out) does not load the native notification modules.
 */
export async function forgetPushToken(): Promise<void> {
  try {
    const token = await pushTokenStorage.get();
    if (token) await pushService.forget(token);
  } catch {
    // Offline or already gone: the sign-out still happens, and the server drops dead tokens on its own.
  }
}
