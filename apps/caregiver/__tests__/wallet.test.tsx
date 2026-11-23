import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import Wallet, { HIDDEN_BALANCE } from "../src/screens/account/Wallet";
import { walletService } from "../src/services/wallet.service";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
  useFocusEffect: jest.fn(),
}));

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
  payout_cadence: "weekly",
  payout_min_kobo: 500000,
  payout_in_progress_kobo: 0,
  next_payout_on: "2026-10-19",
  payouts_blocked_until: null,
};
const bank = {
  bank_name: "Placeholder Bank",
  bank_code: "000",
  verified: true,
  account_number: "0000000000",
  account_name: "Placeholder Caregiver A",
  created_at: "2026-10-06T08:23:31.051733",
  updated_at: "2026-10-06T08:23:31.051735",
};

async function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(walletService, "getBankAccount").mockResolvedValue(bank);
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  await act(async () => {
    await session.signOut();
  });
});

describe("Wallet screen", () => {
  it("shows a spinner while loading", async () => {
    jest.spyOn(walletService, "getWallet").mockReturnValue(new Promise(() => undefined));
    await renderWith(<Wallet />);
    expect(screen.getByTestId("wallet-loading")).toBeTruthy();
  });

  it("shows the error with a retry", async () => {
    const getWallet = jest
      .spyOn(walletService, "getWallet")
      .mockRejectedValueOnce(new ApiError(0, null, "x"))
      .mockResolvedValue(wallet);
    await renderWith(<Wallet />);
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("wallet-balance")).toBeTruthy();
    expect(getWallet).toHaveBeenCalledTimes(2);
  });

  it("converts kobo to naira for the balance and totals", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    await renderWith(<Wallet />);
    expect((await screen.findByTestId("wallet-balance")).props.children).toBe("₦25,000.00");
    expect(screen.getByText("₦40,000.00")).toBeTruthy();
  });

  it("shows pending with its local availability time and no hold line", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue({
      ...wallet, pending_balance: 4000000, total_pending: 4000000, next_available_at: "2026-10-08T19:48:51.599904",
    });
    await renderWith(<Wallet />);
    expect(await screen.findByTestId("wallet-pending")).toBeTruthy();
    expect(screen.getByTestId("wallet-pending").props.children).toMatch(/^₦40,000\.00 pending · available from /);
    expect(screen.queryByText("Under review")).toBeNull();
  });

  it("shows money on hold as under review", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue({ ...wallet, held_balance: 4000000, total_pending: 4000000 });
    await renderWith(<Wallet />);
    expect((await screen.findByTestId("wallet-held")).props.children).toBe("₦40,000.00 on hold");
    expect(screen.getByText("Under review")).toBeTruthy();
    expect(screen.queryByTestId("wallet-pending")).toBeNull();
  });

  it("shows the weekly payout info card and no withdraw button", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    await renderWith(<Wallet />);
    await screen.findByTestId("wallet-balance");
    expect(screen.queryByText(/withdraw$/i)).toBeNull();
    expect(
      screen.getByText("Payouts are sent weekly to your bank account once your available balance is at least ₦5,000."),
    ).toBeTruthy();
  });

  it("uses Figma's total cards, and each opens the Earning Payment list", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    await renderWith(<Wallet />);
    await screen.findByTestId("wallet-balance");
    expect(screen.getByText("Total Amount Paid in")).toBeTruthy();
    expect(screen.getByText("Total Amount Withdrawn")).toBeTruthy();
    expect(screen.getByText("₦15,000.00")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Total Amount Paid in"));
    expect(mockNavigate).toHaveBeenCalledWith("EarningPayment");
    mockNavigate.mockClear();
    await fireEvent.press(screen.getByLabelText("Total Amount Withdrawn"));
    expect(mockNavigate).toHaveBeenCalledWith("EarningPayment");
  });

  it("is titled Payment & Earning with the teal Wallet Balance (NGN) card, and the eye hides and shows the figure", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    await renderWith(<Wallet />);
    expect(await screen.findByText("Payment & Earning")).toBeTruthy();
    expect(screen.getByText("Wallet Balance (NGN)")).toBeTruthy();
    expect(screen.queryByText("Available balance")).toBeNull();
    expect(screen.getByTestId("wallet-balance").props.children).toBe("₦25,000.00");
    await fireEvent.press(screen.getByLabelText("Hide balance"));
    expect(screen.getByTestId("wallet-balance").props.children).toBe(HIDDEN_BALANCE);
    expect(screen.queryByText("₦25,000.00")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Show balance"));
    expect(screen.getByTestId("wallet-balance").props.children).toBe("₦25,000.00");
  });

  it("shows the saved bank account and opens the payment details screen", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    await renderWith(<Wallet />);
    expect(await screen.findByText("Placeholder Caregiver A")).toBeTruthy();
    expect(screen.getByText("0000000000 (Placeholder Bank)")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Edit payment details"));
    expect(mockNavigate).toHaveBeenCalledWith("BankDetails");
    expect(screen.queryByText("Add Payment Method")).toBeNull();
  });

  it("invites the caregiver to add payment details when none are saved", async () => {
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(null);
    await renderWith(<Wallet />);
    await fireEvent.press(await screen.findByText("Add Payment Method"));
    expect(mockNavigate).toHaveBeenCalledWith("BankDetails");
  });
});

describe("Wallet screen: payouts paused", () => {
  it("shows when payouts are paused after a bank change", async () => {
    const until = new Date(Date.now() + 20 * 3600 * 1000).toISOString().replace("Z", "");
    jest.spyOn(walletService, "getWallet").mockResolvedValue({ ...wallet, payouts_blocked_until: until });
    await renderWith(<Wallet />);
    expect(await screen.findByTestId("wallet-paused")).toHaveTextContent(/Payouts are paused until .* because your bank account was added or changed\./);
  });

  it("is ONE banner while paused: the pause and the weekly rule together, not two stacked", async () => {
    const until = new Date(Date.now() + 20 * 3600 * 1000).toISOString().replace("Z", "");
    jest.spyOn(walletService, "getWallet").mockResolvedValue({ ...wallet, payouts_blocked_until: until });
    await renderWith(<Wallet />);
    expect(await screen.findByTestId("wallet-paused")).toHaveTextContent(/After that they are sent weekly once your available balance is at least ₦5,000\./);
    expect(screen.queryByText(/^Payouts are sent weekly to your bank account/)).toBeNull();
  });

  it("hides the notice once the pause has passed", async () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString().replace("Z", "");
    jest.spyOn(walletService, "getWallet").mockResolvedValue({ ...wallet, payouts_blocked_until: past });
    await renderWith(<Wallet />);
    await screen.findByTestId("wallet-balance");
    expect(screen.queryByTestId("wallet-paused")).toBeNull();
  });

  it("asks an account without a bank code to be verified again", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue({ ...bank, bank_code: null, verified: false });
    jest.spyOn(walletService, "getWallet").mockResolvedValue(wallet);
    await renderWith(<Wallet />);
    expect(await screen.findByText("Verify account")).toBeTruthy();
  });
});
