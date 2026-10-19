import type { CaregiverTransaction } from "../src/services/wallet.service";
import {
  currentMonth,
  formatKobo,
  groupTransactions,
  MIN_PAYOUT_NAIRA_TEXT,
  availableFromText,
  monthOptions,
  transactionView,
  walletBalances,
} from "../src/wallet/walletModel";

// Shaped after capture 130 in the backend guide (a withdrawal) plus an earning.
const withdrawal: CaregiverTransaction = {
  id: "t1",
  type: "withdrawal",
  amount: 200000,
  status: "pending",
  bank_name: "Placeholder Bank",
  account_number: "0000000000",
  account_name: "Placeholder Caregiver A",
  reference: null,
  narration: "Placeholder",
  created_at: "2026-10-06T08:23:31.075953",
  updated_at: "2026-10-06T08:23:31.075954",
};
const earning: CaregiverTransaction = {
  id: "t2",
  type: "earning",
  amount: 5500000,
  status: "successful",
  reference: "REF1",
  narration: "Visit ECCADB9F",
  created_at: "2026-10-05T10:00:00",
  updated_at: "2026-10-05T10:00:00",
};

describe("formatKobo", () => {
  it("converts integer kobo to naira with grouping and two decimals", () => {
    expect(formatKobo(0)).toBe("₦0.00");
    expect(formatKobo(2500000)).toBe("₦25,000.00");
    expect(formatKobo(150)).toBe("₦1.50");
  });
});

describe("transactionView", () => {
  it("shows a pending withdrawal as requested, never as paid", () => {
    expect(transactionView(withdrawal)).toMatchObject({
      title: "Withdrawal requested",
      subtitle: "Placeholder Bank 0000000000",
      amount: "-₦2,000.00",
      statusLabel: "Requested",
      tone: "pending",
    });
  });

  it("shows a successful earning with its narration", () => {
    expect(transactionView(earning)).toMatchObject({
      title: "Visit ECCADB9F",
      amount: "+₦55,000.00",
      statusLabel: "Available",
      tone: "success",
    });
  });

  it("falls back to a generic title and flags failures", () => {
    const view = transactionView({ ...withdrawal, type: "earning", narration: null, status: "weird" });
    expect(view.title).toBe("Visit earning");
    expect(transactionView({ ...withdrawal, status: "failed" }).tone).toBe("error");
  });
});

// Shaped after captures 154 (pending), 158 (held) and 164 (released) of the backend guide.
const base = {
  balance: 2300000,
  total_earned: 0,
  total_withdrawn: 0,
  currency: "NGN",
  available_balance: 2300000,
  pending_balance: 4000000,
  held_balance: 0,
  total_pending: 4000000,
  next_available_at: "2026-10-08T19:48:51.599904",
  payout_cadence: "weekly",
  payout_min_kobo: 500000,
  payout_in_progress_kobo: 0,
};

describe("walletBalances", () => {
  it("shows pending with the local time it becomes available (naive UTC read as UTC)", () => {
    const b = walletBalances(base);
    expect(b.available).toBe("₦23,000.00");
    expect(b.pending).toEqual({ amount: "₦40,000.00", availableFrom: availableFromText(base.next_available_at) });
    expect(b.held).toBeNull();
    expect(availableFromText(base.next_available_at)).toBe(
      new Date("2026-10-08T19:48:51.599904Z").toLocaleString("en-NG", {
        weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      }),
    );
  });

  it("shows held when above zero, and no pending line", () => {
    const b = walletBalances({ ...base, pending_balance: 0, held_balance: 4000000, next_available_at: null });
    expect(b.pending).toBeNull();
    expect(b.held).toEqual({ amount: "₦40,000.00" });
  });

  it("hides pending and held when both are zero", () => {
    const b = walletBalances({ ...base, pending_balance: 0, total_pending: 0, next_available_at: null });
    expect(b.pending).toBeNull();
    expect(b.held).toBeNull();
  });

  it("has pending without a date when none is given", () => {
    expect(walletBalances({ ...base, next_available_at: null }).pending?.availableFrom).toBeNull();
  });

  it("states the minimum payout", () => {
    expect(MIN_PAYOUT_NAIRA_TEXT).toBe("₦5,000");
  });
});

describe("earning transactions in plain English", () => {
  const e = { ...earning, narration: "Visit 71DC62E0", available_at: "2026-10-08T19:48:51.599904" };
  it("pending_clearance", () => {
    expect(transactionView({ ...e, status: "pending_clearance" })).toMatchObject({
      title: "Visit 71DC62E0",
      statusLabel: "Pending",
      tone: "pending",
      subtitle: `Available from ${availableFromText(e.available_at as string)}`,
    });
  });
  it("held", () => {
    expect(transactionView({ ...e, status: "held" })).toMatchObject({ statusLabel: "Under review by Oakly", tone: "pending" });
  });
  it("successful earning is available", () => {
    expect(transactionView({ ...e, status: "successful" })).toMatchObject({ statusLabel: "Available", tone: "success", amount: "+₦55,000.00" });
  });
  it("voided", () => {
    expect(transactionView({ ...e, status: "voided" })).toMatchObject({ statusLabel: "Cancelled", tone: "error" });
  });
  it("late cancellation compensation", () => {
    expect(transactionView({ ...e, type: "late_cancel_compensation", narration: null, status: "successful" }).title).toBe(
      "Late cancellation compensation",
    );
  });
});

describe("groupTransactions", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  it("groups by calendar day, newest first, labelling today and yesterday", () => {
    const groups = groupTransactions([earning, withdrawal, { ...earning, id: "t3", created_at: "2026-10-01T09:00:00" }], now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Thu 1 Oct 2026"]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["t1"]);
  });

  it("is empty for no transactions", () => {
    expect(groupTransactions([], now)).toEqual([]);
  });
});

describe("months", () => {
  it("currentMonth is YYYY-MM", () => {
    expect(currentMonth(new Date("2026-10-06T12:00:00Z"))).toBe("2026-10");
  });

  it("lists this month and the previous ones across a year boundary", () => {
    expect(monthOptions(new Date("2026-02-10T12:00:00Z"), 4)).toEqual([
      { value: "2026-02", label: "February 2026" },
      { value: "2026-01", label: "January 2026" },
      { value: "2025-12", label: "December 2025" },
      { value: "2025-11", label: "November 2025" },
    ]);
  });
});
