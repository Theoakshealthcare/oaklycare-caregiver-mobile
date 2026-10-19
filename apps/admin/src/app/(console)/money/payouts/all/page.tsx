import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { PAYOUTS_READ } from "@/lib/payouts";

import { AllPayouts } from "../all-payouts";

export const metadata: Metadata = { title: "All payouts" };

export default function Page() {
  return (
    <RequirePermission anyOf={[PAYOUTS_READ]}>
      <AllPayouts />
    </RequirePermission>
  );
}
