import type { CaregiverTransaction } from "../src/services/wallet.service";
import {
  currentMonth,
  formatKobo,
  groupTransactions,
  monthOptions,
  transactionView,
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
      statusLabel: "Successful",
      tone: "success",
    });
  });

  it("falls back to a generic title and flags failures", () => {
    const view = transactionView({ ...earning, narration: null, status: "failed" });
    expect(view.title).toBe("Visit earning");
    expect(view.tone).toBe("error");
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
