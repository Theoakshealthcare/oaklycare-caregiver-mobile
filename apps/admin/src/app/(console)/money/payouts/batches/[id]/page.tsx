import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { PAYOUTS_READ } from "@/lib/payouts";

import { BatchView } from "../../batch-detail";

export const metadata: Metadata = { title: "Payout batch" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission anyOf={[PAYOUTS_READ]}>
      <BatchView id={id} />
    </RequirePermission>
  );
}
