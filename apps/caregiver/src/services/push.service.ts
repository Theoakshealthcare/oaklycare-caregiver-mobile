import { api } from "@/src/api/client";
import { unwrap, unwrapEmpty } from "@/src/api/unwrap";

export type PushPlatform = "ios" | "android";

export const pushService = {
  /** POST /devices/push-token: an upsert, so calling it again with the same token is fine. */
  register(token: string, platform: PushPlatform) {
    return unwrap(api.POST("/api/v1/devices/push-token", { body: { token, platform } }));
  },

  /** DELETE /devices/push-token (JSON body, always 204). */
  forget(token: string) {
    return unwrapEmpty(api.DELETE("/api/v1/devices/push-token", { body: { token } }));
  },
};
