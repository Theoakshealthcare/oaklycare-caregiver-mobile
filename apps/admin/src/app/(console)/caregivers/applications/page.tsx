import type { Metadata } from "next";
import { Suspense } from "react";

import { RequirePermission } from "@/components/permission-gate";

import { ApplicationsQueue } from "./queue";

export const metadata: Metadata = { title: "Caregiver applications" };

export default function ApplicationsPage() {
  return (
    <RequirePermission anyOf={["caregivers.read"]}>
      <Suspense>
        <ApplicationsQueue />
      </Suspense>
    </RequirePermission>
  );
}
