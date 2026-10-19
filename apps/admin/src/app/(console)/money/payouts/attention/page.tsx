import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { PAYOUTS_READ } from "@/lib/payouts";

import { Attention } from "../attention-queue";

export const metadata: Metadata = { title: "Payouts needing attention" };

export default function Page() {
  return (
    <RequirePermission anyOf={[PAYOUTS_READ]}>
      <Attention />
    </RequirePermission>
  );
}
