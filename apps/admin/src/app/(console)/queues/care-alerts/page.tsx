import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { CARE_ALERTS_PERMISSION } from "@/lib/care-alerts";

import { CareAlertsQueue } from "./care-alerts-queue";

export const metadata: Metadata = { title: "Care alerts" };

export default function Page() {
  return (
    <RequirePermission anyOf={[CARE_ALERTS_PERMISSION]}>
      <CareAlertsQueue />
    </RequirePermission>
  );
}
