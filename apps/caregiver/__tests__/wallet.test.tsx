import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import BankDetails from "../src/screens/account/BankDetails";
import Wallet from "../src/screens/account/Wallet";
import { walletService, type CaregiverTransaction } from "../src/services/wallet.service";
import { currentMonth } from "../src/wallet/walletModel";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
const mockSharePayslip = jest.fn();
jest.mock("../src/wallet/payslip", () => ({ sharePayslip: (...args: unknown[]) => mockSharePayslip(...args) }));

// Amounts are integer kobo, as in capture 122 / 130 of the backend guide.
const wallet = {
  balance: 2500000,
  total_earned: 4000000,
  total_withdrawn: 1500000,
  currency: "NGN",
  available_balance: 2500000,
  pending_balance: 0,
  held_balance: 0,
  total_pending: 0,
  next_available_at: null,
};
const tx = (over: Partial<CaregiverTransaction>): CaregiverTransaction => ({
  id: "t1",
  type: "withdrawal",
  amount: 200000,
  status: "pending",
  bank_name: "Placeholder Bank",
  account_number: "0000000000",
  account_name: "Placeholder Caregiver A",
  reference: null,
  narration: "Placeholder",
  created_at: new Date().toISOString().replace("Z", ""),
  updated_at: new Date().toISOString().replace("Z", ""),
  ...over,
});
const bank = {
  bank_name: "Placeholder Bank",
  account_number: "0000000000",
  account_name: "Placeholder Caregiver A",
  created_at: "2026-10-06T08:23:31.051733",
  updated_at: "2026-10-06T08:23:31.051735",
};

async function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

let alertSpy: jest.SpyInstance;
beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.spyOn(walletService, "getBankAccount").mockResolvedValue(bank);
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  mockSharePayslip.mockReset();
  await act(async () => {
    await session.signOut();
  });
});

describe("Wallet screen", () => {
  it("shows a spinner while loading", async () => {
    jest.spyOn(walletService, "getWallet").mockReturnValue(new Promise(() => undefined));
    jest.spyOn(walletService, "getTransactions").mockReturnValue(new Promise(() => undefined));
    await renderWith(<Wallet />);
    expect(screen.getByTestId("wallet-loading")).toBeTruthy();
  });

  it("shows the error with a retry", async () => {
    const getWallet = jest
      .spyOn(walletService, "getWallet")
      .mockRejectedValueOnce(new ApiError(0, null, "x"))
      .mockResolvedValue(wallet);
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<Wallet />);
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("wallet-balance")).toBeTruthy();
    expect(getWallet).toHaveBeenCalledTimes(2);
  });

  it("converts kobo to naira for the balance and totals", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<Wallet />);
    expect((await screen.findByTestId("wallet-balance")).props.children).toBe("₦25,000.00");
    expect(screen.getByText("Available balance")).toBeTruthy();
    expect(screen.getByText("₦40,000.00")).toBeTruthy();
  });

  it("shows the empty state for a month with no payments", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue({ ...wallet, balance: 0, available_balance: 0, total_earned: 0, total_withdrawn: 0 });
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<Wallet />);
    expect(await screen.findByText("No payments this month")).toBeTruthy();
  });

  it("lists the transactions grouped by date and shows a pending withdrawal as requested", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    const getTx = jest.spyOn(walletService, "getTransactions").mockResolvedValue([
      tx({}),
      tx({ id: "t2", type: "earning", status: "successful", amount: 5500000, narration: "Visit ECCADB9F", reference: "REF1" }),
    ]);
    await renderWith(<Wallet />);
    expect(await screen.findByText("Today")).toBeTruthy();
    expect(screen.getByText("Withdrawal requested")).toBeTruthy();
    expect(screen.getByText("-₦2,000.00")).toBeTruthy();
    expect(screen.getByText("Visit ECCADB9F")).toBeTruthy();
    expect(screen.getByText("+₦55,000.00")).toBeTruthy();
    expect(getTx).toHaveBeenCalledWith(currentMonth());
  });

  it("shows pending with its local availability time and no hold line", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue({
      ...wallet, pending_balance: 4000000, total_pending: 4000000, next_available_at: "2026-10-08T19:48:51.599904",
    });
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<Wallet />);
    expect(await screen.findByTestId("wallet-pending")).toBeTruthy();
    expect(screen.getByTestId("wallet-pending").props.children).toMatch(/^₦40,000\.00 pending · available from /);
    expect(screen.queryByText("Under review by Oakly")).toBeNull();
  });

  it("shows money on hold as under review", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue({ ...wallet, held_balance: 4000000, total_pending: 4000000 });
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<Wallet />);
    expect((await screen.findByTestId("wallet-held")).props.children).toBe("₦40,000.00 on hold");
    expect(screen.getByText("Under review by Oakly")).toBeTruthy();
    expect(screen.queryByTestId("wallet-pending")).toBeNull();
  });

  it("shows the weekly payout info card and no withdraw button", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<Wallet />);
    await screen.findByTestId("wallet-balance");
    expect(screen.queryByText(/withdraw$/i)).toBeNull();
    expect(
      screen.getByText("Payouts are sent weekly to your bank account once your available balance is at least ₦5,000."),
    ).toBeTruthy();
  });

  it("downloads the payslip for the selected month through the share sheet", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    mockSharePayslip.mockResolvedValue(undefined);
    await renderWith(<Wallet />);
    await fireEvent.press(await screen.findByText("Download payslip"));
    await waitFor(() => expect(mockSharePayslip).toHaveBeenCalledWith(currentMonth()));
  });

  it("tells the caregiver when the payslip could not be downloaded", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    mockSharePayslip.mockRejectedValue(new ApiError(0, null, "x"));
    await renderWith(<Wallet />);
    await fireEvent.press(await screen.findByText("Download payslip"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't get your payslip", expect.stringContaining("Can't reach Oakly")));
  });

  it("shows the saved bank account and opens the payment details screen", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<Wallet />);
    expect(await screen.findByText("Placeholder Caregiver A")).toBeTruthy();
    expect(screen.getByText("0000000000 (Placeholder Bank)")).toBeTruthy();
    await fireEvent.press(screen.getByText("Payment details"));
    expect(mockNavigate).toHaveBeenCalledWith("BankDetails");
  });

  it("invites the caregiver to add payment details when none are saved", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(null);
    await renderWith(<Wallet />);
    await fireEvent.press(await screen.findByText("Add payment method"));
    expect(mockNavigate).toHaveBeenCalledWith("BankDetails");
  });
});

describe("BankDetails screen", () => {
  it("shows a spinner while loading", async () => {
    (walletService.getBankAccount as jest.Mock).mockReturnValue(new Promise(() => undefined));
    await renderWith(<BankDetails />);
    expect(screen.getByTestId("bank-loading")).toBeTruthy();
  });

  it("shows the error with a retry", async () => {
    (walletService.getBankAccount as jest.Mock)
      .mockRejectedValueOnce(new ApiError(0, null, "x"))
      .mockResolvedValue(bank);
    await renderWith(<BankDetails />);
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("Placeholder Caregiver A")).toBeTruthy();
  });

  it("empty: no account yet, goes straight to the form", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(null);
    await renderWith(<BankDetails />);
    expect(await screen.findByText("No payment details yet")).toBeTruthy();
    expect(screen.getByText("Save payment details")).toBeTruthy();
  });

  it("success: shows the current account", async () => {
    await renderWith(<BankDetails />);
    expect(await screen.findByText("Placeholder Caregiver A")).toBeTruthy();
    expect(screen.getByText("0000000000")).toBeTruthy();
    expect(screen.getByText("Placeholder Bank")).toBeTruthy();
  });

  it("saves with exactly the schema's three fields", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(null);
    const update = jest.spyOn(walletService, "updateBankAccount").mockResolvedValue(bank);
    await renderWith(<BankDetails />);
    await fireEvent.changeText(await screen.findByPlaceholderText("Bank name"), " Placeholder Bank ");
    await fireEvent.changeText(screen.getByPlaceholderText("10-digit account number"), "0000000000");
    await fireEvent.changeText(screen.getByPlaceholderText("Name on the account"), "Placeholder Caregiver A");
    await fireEvent.press(screen.getByText("Save payment details"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        bank_name: "Placeholder Bank",
        account_number: "0000000000",
        account_name: "Placeholder Caregiver A",
      }),
    );
  });

  it("validates before sending", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(null);
    const update = jest.spyOn(walletService, "updateBankAccount");
    await renderWith(<BankDetails />);
    await fireEvent.changeText(await screen.findByPlaceholderText("10-digit account number"), "123");
    await fireEvent.press(screen.getByText("Save payment details"));
    expect(await screen.findByText("Bank name is required")).toBeTruthy();
    expect(screen.getByText("Account number must be 10 digits")).toBeTruthy();
    expect(screen.getByText("Account name is required")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("shows the server error when saving fails", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(null);
    jest.spyOn(walletService, "updateBankAccount").mockRejectedValue(new ApiError(0, null, "x"));
    await renderWith(<BankDetails />);
    await fireEvent.changeText(await screen.findByPlaceholderText("Bank name"), "B");
    await fireEvent.changeText(screen.getByPlaceholderText("10-digit account number"), "0000000000");
    await fireEvent.changeText(screen.getByPlaceholderText("Name on the account"), "N");
    await fireEvent.press(screen.getByText("Save payment details"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't save", expect.stringContaining("Can't reach Oakly")));
  });
});
