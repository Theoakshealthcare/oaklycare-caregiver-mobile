import { api } from "@/src/api/client";
import { ApiError } from "@/src/api/errors";
import { unwrap } from "@/src/api/unwrap";
import { toPosition, type LiveTracking } from "@/src/domain/tracking";

export const trackingService = {
  /**
   * `GET /booking/booking/{id}/live-tracking` (the path really has "booking" twice). Its two "nothing to show" answers are plain
   * `detail` strings, not coded errors, so they are told apart by status: 404 = no position yet (also "no caregiver assigned"),
   * 409 = the booking is not accepted / on the way / in progress. Every other failure (offline, 401, 403, 5xx) is thrown.
   */
  async get(id: string): Promise<LiveTracking> {
    try {
      const body = await unwrap(api.GET("/api/v1/booking/booking/{booking_id}/live-tracking", { params: { path: { booking_id: id } } }));
      return { kind: "live", position: toPosition(body) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return { kind: "waiting" };
      if (error instanceof ApiError && error.status === 409) return { kind: "closed" };
      throw error;
    }
  },
};
