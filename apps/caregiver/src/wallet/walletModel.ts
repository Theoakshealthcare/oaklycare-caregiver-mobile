import { formatNaira } from "@/src/home/homeModel";
import type { CaregiverTransaction } from "@/src/services/wallet.service";
import { parseBackendDate } from "@/src/utils/dates";

/** The wallet endpoints speak integer kobo (100 kobo = 1 naira); only /caregiver/home speaks naira. */
export function formatKobo(kobo: number): string {
  return formatNaira(kobo / 100);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year (no daylight saving).

/** A date shifted so its UTC fields read as the Africa/Lagos calendar day (the backend's "day"). */
function lagos(date: Date): Date {
  return new Date(date.getTime() + LAGOS_OFFSET_MS);
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export type Tone = "success" | "pending" | "error";

export interface TransactionView {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  statusLabel: string;
  tone: Tone;
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  successful: { label: "Successful", tone: "success" },
  pending: { label: "Requested", tone: "pending" },
  failed: { label: "Failed", tone: "error" },
};

export function transactionView(tx: CaregiverTransaction): TransactionView {
  const status = STATUS[tx.status] ?? { label: tx.status, tone: "pending" as Tone };
  const isWithdrawal = tx.type === "withdrawal";
  return {
    id: tx.id,
    // A pending withdrawal is only requested: no payout process runs yet (guide, section 10).
    title: isWithdrawal
      ? tx.status === "pending"
        ? "Withdrawal requested"
        : "Withdrawal"
      : (tx.narration ?? "Visit earning"),
    subtitle: isWithdrawal ? [tx.bank_name, tx.account_number].filter(Boolean).join(" ") : (tx.reference ?? ""),
    amount: `${isWithdrawal ? "-" : "+"}${formatKobo(tx.amount)}`,
    statusLabel: status.label,
    tone: status.tone,
  };
}

export interface TransactionGroup {
  label: string;
  items: TransactionView[];
}

/** Groups transactions by Lagos calendar day, newest day first. */
export function groupTransactions(txs: CaregiverTransaction[], now: Date = new Date()): TransactionGroup[] {
  const today = lagos(now);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const sorted = [...txs].sort(
    (a, b) => parseBackendDate(b.created_at).getTime() - parseBackendDate(a.created_at).getTime(),
  );
  const groups = new Map<string, TransactionGroup>();
  for (const tx of sorted) {
    const day = lagos(parseBackendDate(tx.created_at));
    const key = dayKey(day);
    let group = groups.get(key);
    if (!group) {
      const label =
        key === dayKey(today)
          ? "Today"
          : key === dayKey(yesterday)
            ? "Yesterday"
            : `${DAYS[day.getUTCDay()]} ${day.getUTCDate()} ${(MONTHS[day.getUTCMonth()] ?? "").slice(0, 3)} ${day.getUTCFullYear()}`;
      group = { label, items: [] };
      groups.set(key, group);
    }
    group.items.push(transactionView(tx));
  }
  return [...groups.values()];
}

function monthValue(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** YYYY-MM for the month the payslip endpoint expects. */
export function currentMonth(now: Date = new Date()): string {
  const d = lagos(now);
  return monthValue(d.getUTCFullYear(), d.getUTCMonth());
}

export function monthOptions(now: Date = new Date(), count = 6): { value: string; label: string }[] {
  const d = lagos(now);
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = d.getUTCMonth() - i;
    const year = d.getUTCFullYear() + Math.floor(index / 12);
    const month = ((index % 12) + 12) % 12;
    options.push({ value: monthValue(year, month), label: `${MONTHS[month]} ${year}` });
  }
  return options;
}
