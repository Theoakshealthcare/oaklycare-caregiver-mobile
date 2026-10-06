import type { Metadata } from "next";

import { OverviewPlaceholder } from "./overview";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return <OverviewPlaceholder />;
}
