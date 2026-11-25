import { Badge } from "@/components/ui/badge";
import { type EarningStatus, STATUS_LABEL } from "@/lib/earnings";

const TONE = {
  pending_clearance: "neutral",
  held: "warning",
  successful: "success",
  voided: "danger",
} as const;

/** Status as text plus a tone, so it is never conveyed by colour alone. Uses the console's own words, not the API's. */
export function EarningStatusBadge({ status }: { status: EarningStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
