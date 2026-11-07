import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { CaregiverTransaction } from "@/src/services/wallet.service";
import { formatDate, parseBackendDate } from "@/src/utils/dates";
import { formatKobo, monthLabel, transactionView } from "@/src/wallet/walletModel";

type Section = { title: string; note?: string; items: CaregiverTransaction[] };

/** What a payslip line says about where an earning stands, in the order a caregiver cares about. */
function sections(txs: CaregiverTransaction[]): Section[] {
  const earnings = txs.filter((t) => t.type !== "withdrawal");
  const by = (status: string) => earnings.filter((t) => t.status === status);
  return [
    { title: "Available", note: "Cleared and in your balance.", items: by("successful") },
    { title: "Pending", note: "Clearing after the visit; paid out once available.", items: by("pending_clearance") },
    { title: "Under review", note: "Oakly is reviewing these visits before they are paid.", items: by("held") },
    { title: "Cancelled", items: by("voided") },
    { title: "Payouts to your bank", items: txs.filter((t) => t.type === "withdrawal") },
  ].filter((s) => s.items.length > 0);
}

/**
 * The month's payslip as a plain-text document: every earning with its status (so pending and held visits show up, which
 * the backend's paid-only CSV leaves out), a total per status, and the payouts. Built from the same list the Wallet shows.
 */
export function buildPayslipText(month: string, txs: CaregiverTransaction[]): string {
  const lines: string[] = [`Oakly payslip: ${monthLabel(month)}`, ""];
  const sorted = [...txs].sort((a, b) => parseBackendDate(a.created_at).getTime() - parseBackendDate(b.created_at).getTime());
  for (const section of sections(sorted)) {
    const total = section.items.reduce((sum, t) => sum + t.amount, 0);
    lines.push(`${section.title.toUpperCase()}  (${section.items.length}, ${formatKobo(total)})`);
    if (section.note) lines.push(section.note);
    for (const t of section.items) {
      const view = transactionView(t);
      lines.push(`  ${formatDate(parseBackendDate(t.created_at))}  ${view.title}  ${view.amount}`);
      if (view.subtitle) lines.push(`      ${view.subtitle}`);
    }
    lines.push("");
  }
  lines.push("Amounts are in Nigerian naira. Only the Available total is in your balance.");
  return `${lines.join("\n")}\n`;
}

/** Saves the month's payslip in the app cache and opens the native share sheet on it. */
export async function sharePayslip(month: string, txs: CaregiverTransaction[]): Promise<void> {
  const file = new File(Paths.cache, `payslip_${month}.txt`);
  file.create({ overwrite: true });
  file.write(buildPayslipText(month, txs));
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/plain",
    UTI: "public.plain-text",
    dialogTitle: `Payslip ${monthLabel(month)}`,
  });
}
