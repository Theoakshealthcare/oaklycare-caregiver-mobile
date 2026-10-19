import { StatusBadge } from "@/components/status-badge";
import { PayoutActions } from "@/components/payout-actions";
import { formatNaira, formatWat } from "@/lib/format";
import type { Payout } from "@/lib/payouts";

/** What the admin needs to see on a payout: why it is stuck, what was recovered, and the attempt trail. */
function Notes({ p }: { p: Payout }) {
  return (
    <div className="grid gap-1 text-xs">
      {p.status === "needs_attention" ? (
        <p role="alert" className="font-medium text-destructive">
          Needs a person. Check Paystack before resolving.
        </p>
      ) : null}
      {p.failure_reason ? <p>{p.failure_reason}</p> : null}
      {p.cancel_reason ? <p>Cancelled: {p.cancel_reason}</p> : null}
      {p.shortfall_kobo > 0 ? <p>Shortfall: {formatNaira(p.shortfall_kobo)} paid out and not recovered</p> : null}
      {p.returned_kobo > 0 || p.netted_kobo > 0 ? (
        <p>
          Returned {formatNaira(p.returned_kobo)}, kept against shortfall {formatNaira(p.netted_kobo)}
        </p>
      ) : null}
      {p.attempt_history.length > 1 || p.attempt_history.some((a) => a.failure_reason) ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            {p.attempts} attempt{p.attempts === 1 ? "" : "s"}
          </summary>
          <ol className="mt-1 grid gap-1">
            {p.attempt_history.map((a) => (
              <li key={a.reference}>
                #{a.attempt} {a.status}
                {a.failure_reason ? `: ${a.failure_reason}` : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

export function PayoutsTable({
  payouts,
  caption,
  showActions = true,
  onDone,
}: {
  payouts: Payout[];
  caption: string;
  showActions?: boolean;
  onDone?: (notice: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[60rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">Caregiver</th>
            <th scope="col" className="px-3 py-2">Batch</th>
            <th scope="col" className="px-3 py-2 text-right">Amount</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Notes</th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id} className="border-b align-top last:border-0">
              <td className="px-3 py-2">
                <div className="font-medium">{p.caregiver_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {p.bank_name} {p.account_number}
                </div>
                {p.caregiver_payouts_frozen_at ? (
                  <div className="mt-1 text-xs font-medium text-destructive">
                    Caregiver frozen since {formatWat(p.caregiver_payouts_frozen_at)}
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{p.batch_period ?? "—"}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{formatNaira(p.amount_kobo)}</td>
              <td className="px-3 py-2">
                <StatusBadge value={p.status} />
              </td>
              <td className="px-3 py-2">
                <Notes p={p} />
              </td>
              <td className="px-3 py-2">{showActions ? <PayoutActions payout={p} onDone={onDone} /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
