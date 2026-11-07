import { formatNairaValue } from "@/lib/format";

/**
 * The approval rules, in the console's words. `limitNaira` comes from a refund's detail (policy value); the list
 * has none, so it names the default instead of guessing.
 */
export function RefundRules({ limitNaira }: { limitNaira?: number }) {
  const limit = limitNaira === undefined ? "₦50,000 unless policy changes it" : formatNairaValue(limitNaira);
  return (
    <aside aria-label="Refund rules" className="grid gap-1 rounded-lg border bg-muted/40 p-4 text-sm">
      <h2 className="font-semibold">How refunds are approved</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Finance approves up to the cumulative limit per booking ({limit}): this refund plus the booking&apos;s other approved,
          in-flight and succeeded refunds, so a big refund can&apos;t be split to get under it.
        </li>
        <li>A Super Admin approves anything above the limit.</li>
        <li>A refund raised by staff has to be approved by a different admin.</li>
        <li>
          Approving does not send the money. Paystack&apos;s answer finishes it, and a card refund can take up to 10 business days
          to reach the family after it is processed.
        </li>
      </ul>
    </aside>
  );
}
