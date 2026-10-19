import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { BOOKINGS_READ } from "@/lib/bookings";

import { BookingView } from "../booking-detail";

export const metadata: Metadata = { title: "Booking" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission anyOf={[BOOKINGS_READ]}>
      <BookingView id={id} />
    </RequirePermission>
  );
}
