import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { BOOKING_POLICY_READ } from "@/lib/booking-policy";

import { BookingPolicyView } from "./booking-policy";

export const metadata: Metadata = { title: "Booking policy" };

export default function Page() {
  return (
    <RequirePermission anyOf={BOOKING_POLICY_READ}>
      <BookingPolicyView />
    </RequirePermission>
  );
}
