/**
 * Words for a booking's own cancel terms (backend `cancel_terms` on the booking detail, admin guide 12.4a).
 * Money is kobo on the wire; formatted only here.
 */
import { formatNaira, formatWat } from "@/lib/format";
import type { CancelTerms } from "@/lib/bookings";

type Tier = NonNullable<CancelTerms["would_apply_now"]["tier"]>;

const TIER_NAME: Record<Tier, string> = { none: "free", standard: "standard fee", late: "late fee" };

const REFUSAL: Record<NonNullable<CancelTerms["would_apply_now"]["refusal"]>, string> = {
  in_progress: "Not possible: the visit is in progress.",
  closed: "Not possible: the booking is closed.",
  unpaid: "Not applicable: not paid yet, so the family cancels for free.",
};

export interface CancelTermsSummary {
  source: string;
  free: string;
  standard: string;
  late: string;
  now: string;
  applied: string | null;
  asOf: string;
}

export function cancelTermsSummary(t: CancelTerms): CancelTermsSummary {
  const p = t.policy;
  const now = t.would_apply_now;
  let nowText: string;
  if (!now.allowed) {
    nowText = now.refusal ? REFUSAL[now.refusal] : "Not possible.";
  } else if (!now.tier || now.tier === "none") {
    nowText = `Free: the family is refunded ${formatNaira(now.refund_kobo)}.`;
  } else {
    const name = TIER_NAME[now.tier];
    nowText = `${name.charAt(0).toUpperCase()}${name.slice(1)}, ${now.fee_percent}% of the service fee: the family pays ${formatNaira(now.fee_kobo)} and is refunded ${formatNaira(now.refund_kobo)}.`;
  }
  let applied: string | null = null;
  if (t.applied) {
    applied =
      t.applied.tier === "none"
        ? "Cancelled by the family: free."
        : `Cancelled by the family under the ${TIER_NAME[t.applied.tier]}: ${t.applied.fee_kobo === null || t.applied.fee_kobo === undefined ? "fee not recorded" : `${formatNaira(t.applied.fee_kobo)} kept`}.`;
  }
  return {
    source:
      t.policy_source === "booking_snapshot"
        ? "Saved on this booking"
        : "The current booking policy (nothing is saved on this booking yet)",
    free: `More than ${p.free_hours} h before the visit`,
    standard: `${p.fee_percent}% of the service fee, from ${p.free_hours} h to ${p.late_hours} h before`,
    late: `${p.late_fee_percent}% of the service fee, inside ${p.late_hours} h or once the caregiver is on the way`,
    now: nowText,
    applied,
    asOf: `As of ${formatWat(now.as_of)}.`,
  };
}
