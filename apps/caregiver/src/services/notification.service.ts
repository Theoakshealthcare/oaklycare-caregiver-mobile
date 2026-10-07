import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type CaregiverNotification = Schemas["BookingNotificationResponse"];

export const notificationService = {
  list() {
    return unwrap(api.GET("/api/v1/booking/caregiver/notifications"));
  },
};
