import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { PAYOUTS_READ } from "@/lib/payouts";

import { BankReviewsQueue } from "../bank-reviews-queue";

export const metadata: Metadata = { title: "Account name reviews" };

export default function Page() {
  return (
    <RequirePermission anyOf={[PAYOUTS_READ]}>
      <BankReviewsQueue />
    </RequirePermission>
  );
}
