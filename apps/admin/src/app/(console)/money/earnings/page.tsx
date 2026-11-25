import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { EARNINGS_READ } from "@/lib/earnings";

import { EarningsList } from "./earnings-list";

export const metadata: Metadata = { title: "Earnings" };

export default function Page() {
  return (
    <RequirePermission anyOf={[EARNINGS_READ]}>
      <EarningsList />
    </RequirePermission>
  );
}
