import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { PAYOUTS_READ } from "@/lib/payouts";

import { PayoutBatches } from "./batches";

export const metadata: Metadata = { title: "Payout batches" };

export default function Page() {
  return (
    <RequirePermission anyOf={[PAYOUTS_READ]}>
      <PayoutBatches />
    </RequirePermission>
  );
}
