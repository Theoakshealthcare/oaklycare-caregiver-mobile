import { formatNaira } from "@/src/home/homeModel";
import type { CaregiverTransaction, WalletSummary } from "@/src/services/wallet.service";
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

export const MIN_PAYOUT_NAIRA_TEXT = "₦5,000";

/** "Thu, 8 Oct, 8:48 pm" in the phone's local time; the backend sends naive UTC. */
export function availableFromText(iso: string, locale = "en-NG"): string {
  const date = parseBackendDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export interface WalletBalances {
  available: string;
  pending: { amount: string; availableFrom: string | null } | null;
  held: { amount: string } | null;
}

export function walletBalances(summary: WalletSummary): WalletBalances {
  const from = summary.next_available_at ? availableFromText(summary.next_available_at) : "";
  return {
    available: formatKobo(summary.available_balance),
    pending:
      summary.pending_balance > 0
        ? { amount: formatKobo(summary.pending_balance), availableFrom: from || null }
        : null,
    held: summary.held_balance > 0 ? { amount: formatKobo(summary.held_balance) } : null,
  };
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  successful: { label: "Successful", tone: "success" },
  pending: { label: "Requested", tone: "pending" },
  failed: { label: "Failed", tone: "error" },
};

/** Earnings use their own lifecycle: pending_clearance -> successful, or held / voided (backend guide). */
const EARNING_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending_clearance: { label: "Pending", tone: "pending" },
  held: { label: "Under review by Oakly", tone: "pending" },
  successful: { label: "Available", tone: "success" },
  voided: { label: "Cancelled", tone: "error" },
};

export function transactionView(tx: CaregiverTransaction): TransactionView {
  const isWithdrawal = tx.type === "withdrawal";
  const table = isWithdrawal ? STATUS : EARNING_STATUS;
  const status = table[tx.status] ?? { label: tx.status, tone: "pending" as Tone };
  const earningTitle = tx.type === "late_cancel_compensation" ? "Late cancellation compensation" : "Visit earning";
  const waiting = tx.status === "pending_clearance" && tx.available_at ? availableFromText(tx.available_at) : "";
  return {
    id: tx.id,
    // Historic withdrawals are only requested: Oakly now sends payouts weekly.
    title: isWithdrawal
      ? tx.status === "pending"
        ? "Withdrawal requested"
        : "Withdrawal"
      : (tx.narration ?? earningTitle),
    subtitle: isWithdrawal
      ? [tx.bank_name, tx.account_number].filter(Boolean).join(" ")
      : waiting
        ? `Available from ${waiting}`
        : (tx.reference ?? ""),
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

/** "Thu, 8 Oct, 8:48 pm" when payouts are paused (account just changed), else null. `now` is injectable for tests. */
export function payoutsPausedUntil(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const date = parseBackendDate(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() <= now) return null;
  return availableFromText(iso);
}

export const PAUSE_REASON = "because you changed your bank account";

export const ACCOUNT_NUMBER_LENGTH = 10;

export type BankAccountState = "none" | "needs_resave" | "ready";

/** Accounts saved before the verified flow have no bank_code and cannot be paid until saved again. */
export function bankAccountState(account: { bank_code?: string | null; verified: boolean } | null | undefined): BankAccountState {
  if (!account) return "none";
  return account.verified && account.bank_code ? "ready" : "needs_resave";
}

/** Returns a problem with the typed number, or null when it can be checked. */
export function accountNumberProblem(value: string): string | null {
  return /^\d{10}$/.test(value) ? null : `An account number has ${ACCOUNT_NUMBER_LENGTH} digits.`;
}

/** Case-insensitive "contains" filter for the bank picker. */
export function filterBanks<T extends { name: string }>(banks: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : [...banks];
}
