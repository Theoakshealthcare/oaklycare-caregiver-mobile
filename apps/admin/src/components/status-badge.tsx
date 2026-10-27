import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

type Tone = "neutral" | "success" | "warning" | "danger";

const TONES: Record<string, Tone> = {
  approved: "success",
  verified: "success",
  cleared: "success",
  under_review: "warning",
  pending: "warning",
  in_progress: "warning",
  changes_requested: "warning",
  rejected: "danger",
  suspended: "danger",
  failed: "danger",
  reversed: "danger",
  needs_attention: "danger",
  success: "success",
  processing: "warning",
  pending_approval: "warning",
  accepted: "success",
  en_route: "success",
  completed: "success",
  paid: "success",
  declined: "danger",
  unmatched: "danger",
  address_check: "warning",
  sla_breached: "warning",
  succeeded: "success",
  needs_review: "danger",
};

/** Status as text plus a tone, so state is never conveyed by colour alone. */
export function StatusBadge({ value }: { value: string | null | undefined }) {
  return <Badge tone={(value && TONES[value]) || "neutral"}>{humanize(value)}</Badge>;
}
