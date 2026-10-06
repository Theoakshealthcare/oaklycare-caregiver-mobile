import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";

import { ApplicationDetailView } from "./detail";

export const metadata: Metadata = { title: "Application" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission anyOf={["caregivers.read"]}>
      <ApplicationDetailView id={id} />
    </RequirePermission>
  );
}
