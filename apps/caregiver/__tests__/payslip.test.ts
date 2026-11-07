import { type CaregiverTransaction } from "../src/services/wallet.service";
import { buildPayslipText, sharePayslip } from "../src/wallet/payslip";

const mockCreate = jest.fn();
const mockWrite = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache/" },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({
    uri: `file:///cache/${name}`,
    create: (...args: unknown[]) => mockCreate(...args),
    write: (...args: unknown[]) => mockWrite(...args),
  })),
}));
const mockIsAvailable = jest.fn();
const mockShare = jest.fn();
jest.mock("expo-sharing", () => ({
  isAvailableAsync: () => mockIsAvailable(),
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));

// Noon UTC keeps the calendar day the same in every time zone the tests may run in.
const tx = (over: Partial<CaregiverTransaction>): CaregiverTransaction => ({
  id: "t1",
  type: "earning",
  amount: 4000000,
  status: "pending_clearance",
  bank_name: null,
  account_number: null,
  account_name: null,
  reference: null,
  narration: "Visit AAAA1111",
  created_at: "2026-11-07T12:00:00",
  updated_at: "2026-11-07T12:00:00",
  available_at: "2026-11-08T12:00:00",
  ...over,
});

const MONTH = [
  tx({ id: "a", status: "successful", amount: 5500000, narration: "Visit PAID0001", available_at: null }),
  tx({ id: "b", status: "pending_clearance", narration: "Visit PEND0002" }),
  tx({ id: "c", status: "held", narration: "Visit HELD0003", available_at: null }),
  tx({ id: "d", status: "voided", amount: 1000000, narration: "Visit VOID0004", available_at: null }),
  tx({ id: "e", type: "withdrawal", status: "successful", amount: 2000000, narration: "Weekly payout", bank_name: "Placeholder Bank", account_number: "0000000000" }),
];

describe("buildPayslipText", () => {
  const text = buildPayslipText("2026-11", MONTH);

  it("names the month and lists every status, pending and held included", () => {
    expect(text).toContain("Oakly payslip: November 2026");
    for (const heading of ["AVAILABLE", "PENDING", "UNDER REVIEW", "CANCELLED", "PAYOUTS TO YOUR BANK"]) {
      expect(text).toContain(heading);
    }
    for (const visit of ["Visit PAID0001", "Visit PEND0002", "Visit HELD0003", "Visit VOID0004"]) {
      expect(text).toContain(visit);
    }
  });

  it("gives a count and a total per section", () => {
    expect(text).toContain("AVAILABLE  (1, ₦55,000.00)");
    expect(text).toContain("PENDING  (1, ₦40,000.00)");
    expect(text).toContain("UNDER REVIEW  (1, ₦40,000.00)");
    expect(text).toContain("PAYOUTS TO YOUR BANK  (1, ₦20,000.00)");
  });

  it("explains what pending and under review mean, and when pending money arrives", () => {
    expect(text).toMatch(/Oakly is reviewing these visits before they are paid/);
    expect(text).toMatch(/Available from /);
  });

  it("is plain readable text, not a CSV header", () => {
    expect(text).not.toMatch(/^Date,Amount/);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("leaves out sections that have no rows", () => {
    const only = buildPayslipText("2026-11", [MONTH[1] as CaregiverTransaction]);
    expect(only).toContain("PENDING");
    expect(only).not.toContain("UNDER REVIEW");
    expect(only).not.toContain("PAYOUTS TO YOUR BANK");
  });
});

describe("sharePayslip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailable.mockResolvedValue(true);
    mockShare.mockResolvedValue(undefined);
  });

  it("saves the text to the cache and opens the share sheet on it", async () => {
    await sharePayslip("2026-11", MONTH);
    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
    expect(mockWrite).toHaveBeenCalledWith(buildPayslipText("2026-11", MONTH));
    expect(mockShare).toHaveBeenCalledWith("file:///cache/payslip_2026-11.txt", {
      mimeType: "text/plain",
      UTI: "public.plain-text",
      dialogTitle: "Payslip November 2026",
    });
  });

  it("explains when this device cannot share files", async () => {
    mockIsAvailable.mockResolvedValue(false);
    await expect(sharePayslip("2026-11", MONTH)).rejects.toThrow("Sharing isn't available on this device.");
    expect(mockShare).not.toHaveBeenCalled();
  });
});
