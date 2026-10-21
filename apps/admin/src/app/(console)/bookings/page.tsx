import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { BOOKINGS_READ } from "@/lib/bookings";

import { BookingsList } from "./bookings-list";

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return (
    <RequirePermission anyOf={[BOOKINGS_READ]}>
      <BookingsList />
    </RequirePermission>
  );
}
