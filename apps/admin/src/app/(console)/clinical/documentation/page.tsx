import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";
import { DOCUMENTATION_READ } from "@/lib/visit-documentation";

import { DocumentationList } from "./documentation-list";

export const metadata: Metadata = { title: "Caregiver documentation" };

export default function Page() {
  return (
    <RequirePermission anyOf={[DOCUMENTATION_READ]}>
      <DocumentationList />
    </RequirePermission>
  );
}
