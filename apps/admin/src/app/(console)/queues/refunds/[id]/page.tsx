import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { REFUNDS_READ } from "@/lib/refunds";

import { RefundView } from "../refund-detail";

export const metadata: Metadata = { title: "Refund" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission anyOf={REFUNDS_READ}>
      <RefundView id={id} />
    </RequirePermission>
  );
}
