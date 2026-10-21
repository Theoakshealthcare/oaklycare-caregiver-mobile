import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { BOOKINGS_READ } from "@/lib/bookings";

import { UnmatchedQueue } from "./unmatched-queue";

export const metadata: Metadata = { title: "Unmatched bookings" };

export default function Page() {
  return (
    <RequirePermission anyOf={[BOOKINGS_READ]}>
      <UnmatchedQueue />
    </RequirePermission>
  );
}
