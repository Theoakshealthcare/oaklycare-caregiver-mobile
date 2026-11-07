import { api } from "@/src/api/client";
import { unwrap, unwrapEmpty } from "@/src/api/unwrap";

export type PushPlatform = "ios" | "android";

export const notificationsService = {
  /** `GET /patient/notifications`. Newest first; `unread_count` covers the whole feed, not the page. limit 1 to 100. */
  list(limit: number, offset: number) {
    return unwrap(api.GET("/api/v1/patient/notifications", { params: { query: { limit, offset } } }));
  },

  /** Idempotent: reading a read notice returns 200 and keeps the first `read_at`. 404 when it is not yours or gone. */
  markRead(id: string) {
    return unwrap(api.POST("/api/v1/patient/notifications/{notification_id}/read", { params: { path: { notification_id: id } } }));
  },

  readAll() {
    return unwrap(api.POST("/api/v1/patient/notifications/read-all"));
  },
};

export const pushService = {
  /** `POST /devices/push-token`: an upsert, so calling it again with the same token is fine. Expo tokens only (else 422). */
  register(token: string, platform: PushPlatform) {
    return unwrap(api.POST("/api/v1/devices/push-token", { body: { token, platform } }));
  },

  /** `DELETE /devices/push-token` (JSON body, always 204). */
  forget(token: string) {
    return unwrapEmpty(api.DELETE("/api/v1/devices/push-token", { body: { token } }));
  },
};
