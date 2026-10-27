import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { REFUNDS_READ } from "@/lib/refunds";

import { RefundsList } from "./refunds-list";

export const metadata: Metadata = { title: "Refunds" };

export default function Page() {
  return (
    <RequirePermission anyOf={REFUNDS_READ}>
      <RefundsList />
    </RequirePermission>
  );
}
