import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, waitFor, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Keyboard, Linking, StyleSheet } from "react-native";

import { ApiError, BANK_NAME_MISMATCH_MESSAGE, isBankNameMismatch } from "../src/api/errors";
import { unwrap } from "../src/api/unwrap";
import { supportUrl } from "../src/config/contact";
import * as toast from "../src/components/ui/toast";
import { session } from "../src/auth";
import BankDetails from "../src/screens/account/BankDetails";
import { walletService } from "../src/services/wallet.service";
import { accountNumberProblem, bankAccountState, filterBanks, payoutsPausedUntil } from "../src/wallet/walletModel";

jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
  useFocusEffect: jest.fn(),
}));

// Shapes follow backend captures 124 (banks), 125 (resolve), 127 and 178 (bank account); placeholder data only.
const banks = [
  { name: "Placeholder Bank", code: "058" },
  { name: "Sample Microfinance Bank", code: "090" },
];
const resolved = { account_name: "PLACEHOLDER CAREGIVER A", account_number: "0000000000", bank_code: "058", bank_name: "Placeholder Bank" };
const saved = {
  bank_name: "Placeholder Bank",
  bank_code: "058",
  account_number: "0000000000",
  account_name: "PLACEHOLDER CAREGIVER A",
  verified: true,
  payouts_blocked_until: null as string | null,
  created_at: "2026-10-12T13:35:26.985349",
  updated_at: "2026-10-12T13:35:26.985349",
};
const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString().replace("Z", "");

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(
    <QueryClientProvider client={client}>
      <BankDetails />
    </QueryClientProvider>,
  );
}

async function fillAndCheck() {
  await fireEvent.press(await screen.findByLabelText("Choose your bank"));
  await fireEvent.press(await screen.findByText("Placeholder Bank"));
  await fireEvent.changeText(screen.getByPlaceholderText("10 digits"), "0000000000");
  await fireEvent.press(screen.getByText("Check account"));
}

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(walletService, "getBankAccount").mockResolvedValue(null);
  jest.spyOn(walletService, "getBanks").mockResolvedValue(banks);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => {
    await session.signOut();
  });
});

describe("bank picker modal (DP2-06)", () => {
  it("has a Back link that closes the list, and starts below the top inset", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Choose your bank"));
    expect(await screen.findByPlaceholderText("Search banks")).toBeTruthy();
    expect(screen.getAllByText("Back")).toHaveLength(2); // the screen's own Back behind the list, and the list's
    // jest's safe-area mock has a zero top inset: the padding is the inset plus 12, never the old fixed 56.
    expect(screen.getByTestId("bank-picker").props.style.paddingTop).toBe(12);
    await fireEvent.press(screen.getByLabelText("Close bank list"));
    await waitFor(() => expect(screen.queryByPlaceholderText("Search banks")).toBeNull());
  });
});

describe("BankDetails screen", () => {
  it("shows a spinner while loading", async () => {
    (walletService.getBankAccount as jest.Mock).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    expect(screen.getByTestId("bank-loading")).toBeTruthy();
  });

  it("shows the error with a retry", async () => {
    (walletService.getBankAccount as jest.Mock).mockRejectedValueOnce(new ApiError(0, null, "x")).mockResolvedValue(saved);
    await renderScreen();
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("PLACEHOLDER CAREGIVER A")).toBeTruthy();
  });

  it("empty: no account yet opens the add form", async () => {
    await renderScreen();
    expect(await screen.findByText("Add your bank account")).toBeTruthy();
    expect(screen.getByText("Check account")).toBeTruthy();
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("view: shows the saved account and the 24 h change warning", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(saved);
    await renderScreen();
    expect(await screen.findByText("PLACEHOLDER CAREGIVER A")).toBeTruthy();
    expect(screen.getByText("0000000000")).toBeTruthy();
    expect(screen.getByText("Change bank account")).toBeTruthy();
    expect(screen.getByText(/changing your bank account pauses payouts for 24 hours/)).toBeTruthy();
    expect(screen.queryByTestId("bank-paused")).toBeNull();
  });

  it("view: shows payouts paused while payouts_blocked_until is in the future", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue({ ...saved, payouts_blocked_until: inHours(20) });
    await renderScreen();
    expect(await screen.findByTestId("bank-paused")).toHaveTextContent(/Payouts are paused until .* because your bank account was added or changed\./);
  });

  it("view: an account without a bank code must be verified again", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue({ ...saved, bank_code: null, verified: false });
    await renderScreen();
    expect(await screen.findByTestId("bank-resave")).toBeTruthy();
    expect(screen.getByText("Verify bank account")).toBeTruthy();
  });

  it("dismisses the keyboard once the 10th digit is typed, not before", async () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
    await renderScreen();
    const field = await screen.findByPlaceholderText("10 digits");
    await fireEvent.changeText(field, "000000000");
    expect(dismiss).not.toHaveBeenCalled();
    await fireEvent.changeText(field, "0000000000");
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("info rows let the message shrink inside the card instead of overflowing its padding", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue({ ...saved, payouts_blocked_until: inHours(12) });
    await renderScreen();
    const body = await screen.findByTestId("bank-paused-body");
    expect(StyleSheet.flatten(body.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
  });

  it("validation: needs a bank and a 10-digit number before any lookup", async () => {
    const resolve = jest.spyOn(walletService, "resolveBankAccount");
    await renderScreen();
    await fireEvent.press(await screen.findByText("Check account"));
    expect(screen.getByText("Choose a bank from the list.")).toBeTruthy();
    expect(screen.getByText("An account number has 10 digits.")).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("resolve success: shows the account name to confirm", async () => {
    const resolve = jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(resolved);
    await renderScreen();
    await fillAndCheck();
    expect(await screen.findByText("PLACEHOLDER CAREGIVER A")).toBeTruthy();
    expect(resolve).toHaveBeenCalledWith({ bank_code: "058", account_number: "0000000000" });
    expect(screen.getByText("Yes, this is my account")).toBeTruthy();
  });

  it.each([
    [400, "We could not find that account. Check the account number and the bank."],
    [429, "Too many account checks. Please wait a minute and try again."],
    [503, "We cannot check the account right now. Please try again in a moment."],
  ])("resolve failure %d shows the backend's sentence", async (status, detail) => {
    jest.spyOn(walletService, "resolveBankAccount").mockRejectedValue(new ApiError(status, { detail }, "x"));
    await renderScreen();
    await fillAndCheck();
    expect(await screen.findByTestId("bank-failure")).toHaveTextContent(detail);
    expect(screen.queryByText("Yes, this is my account")).toBeNull();
  });

  it("save success: sends only bank_code + account_number and tells the caregiver about the 24 h pause", async () => {
    jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(resolved);
    const update = jest.spyOn(walletService, "updateBankAccount").mockResolvedValue({ ...saved, payouts_blocked_until: inHours(24) });
    await renderScreen();
    await fillAndCheck();
    await fireEvent.press(await screen.findByText("Yes, this is my account"));
    expect(update).toHaveBeenCalledWith({ bank_code: "058", account_number: "0000000000" });
    expect(await screen.findByTestId("bank-saved-notice")).toHaveTextContent(/payouts are paused for 24 hours because your bank account was added or changed, until /);
    expect(screen.getByText("PLACEHOLDER CAREGIVER A")).toBeTruthy();
  });

  it("save success without a pause just confirms", async () => {
    const showToast = jest.spyOn(toast, "showToast");
    jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(resolved);
    jest.spyOn(walletService, "updateBankAccount").mockResolvedValue(saved);
    await renderScreen();
    await fillAndCheck();
    await fireEvent.press(await screen.findByText("Yes, this is my account"));
    expect(await screen.findByTestId("bank-saved-notice")).toHaveTextContent(/Your bank account is saved\./);
    expect(showToast).toHaveBeenCalledWith("Payment Details has been updated");
    expect(screen.getByTestId("bank-saved-notice")).not.toHaveTextContent(/paused/);
  });

  it("save failure shows the backend's sentence and keeps the form", async () => {
    const detail = "This account cannot receive payouts. Check the account number and the bank.";
    jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(resolved);
    jest.spyOn(walletService, "updateBankAccount").mockRejectedValue(new ApiError(400, { detail }, "x"));
    await renderScreen();
    await fillAndCheck();
    await fireEvent.press(await screen.findByText("Yes, this is my account"));
    expect(await screen.findByTestId("bank-failure")).toHaveTextContent(detail);
  });

  it("change flow: starts from the saved account and can be cancelled", async () => {
    (walletService.getBankAccount as jest.Mock).mockResolvedValue(saved);
    await renderScreen();
    await fireEvent.press(await screen.findByText("Change bank account"));
    expect(await screen.findByText("Check account")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancel"));
    expect(await screen.findByText("PLACEHOLDER CAREGIVER A")).toBeTruthy();
  });

  it("bank picker: searches the list and shows a retry when it fails to load", async () => {
    jest.spyOn(walletService, "getBanks").mockRejectedValueOnce(new ApiError(0, null, "x")).mockResolvedValue(banks);
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Choose your bank"));
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    await fireEvent.changeText(screen.getByPlaceholderText("Search banks"), "micro");
    expect(await screen.findByText("Sample Microfinance Bank")).toBeTruthy();
    expect(screen.queryByText("Placeholder Bank")).toBeNull();
  });
});

// What the backend answers when the resolved account name is not the caregiver's own (DP2-05): HTTP 422 with a
// structured detail. Built through the real `unwrap`, so the app's own error construction is what is tested.
// The shape comes from the backend branch brief, not from a live capture: that branch is not merged yet.
const nameMismatch = () =>
  unwrap(
    Promise.resolve({
      error: { detail: { code: "bank_account_name_mismatch", message: "Account name does not match your profile." } },
      response: { ok: false, status: 422, headers: new Headers() } as Response,
    }),
  ).then(
    () => {
      throw new Error("expected the call to be refused");
    },
    (error: unknown) => error as ApiError,
  );

describe("bank account name mismatch (DP2-05)", () => {
  it("is read from detail.code, whatever the backend's sentence says", async () => {
    const err = await nameMismatch();
    expect(err.status).toBe(422);
    expect(isBankNameMismatch(err)).toBe(true);
    expect(isBankNameMismatch(new ApiError(422, { detail: "Some other 422" }, "x"))).toBe(false);
    expect(isBankNameMismatch(new ApiError(400, { detail: { code: "bank_account_name_mismatch" } }, "x"))).toBe(false);
    expect(isBankNameMismatch(new Error("x"))).toBe(false);
  });

  it("shows the inline message with a Contact support link when saving is refused", async () => {
    const mismatch = await nameMismatch();
    jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(resolved);
    jest.spyOn(walletService, "updateBankAccount").mockRejectedValue(mismatch);
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderScreen();
    await fillAndCheck();
    await fireEvent.press(await screen.findByText("Yes, this is my account"));

    expect(await screen.findByTestId("bank-failure")).toHaveTextContent(
      "The account name must match the name on your Oakly profile. If your name is different, contact support.",
    );
    expect(BANK_NAME_MISMATCH_MESSAGE).toBe(
      "The account name must match the name on your Oakly profile. If your name is different, contact support.",
    );
    await fireEvent.press(screen.getByTestId("bank-contact-support"));
    expect(open).toHaveBeenCalledWith(supportUrl());
  });

  it("also covers a refusal at the lookup step, and clears when the caregiver changes the details", async () => {
    jest.spyOn(walletService, "resolveBankAccount").mockRejectedValue(await nameMismatch());
    await renderScreen();
    await fillAndCheck();
    expect(await screen.findByTestId("bank-failure")).toHaveTextContent(/must match the name on your Oakly profile/);
    expect(screen.getByTestId("bank-contact-support")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("10 digits"), "000000000");
    expect(screen.queryByTestId("bank-failure")).toBeNull();
    expect(screen.queryByTestId("bank-contact-support")).toBeNull();
  });

  it("gives no support link for other bank failures", async () => {
    jest.spyOn(walletService, "resolveBankAccount").mockRejectedValue(new ApiError(400, { detail: "Could not resolve account" }, "x"));
    await renderScreen();
    await fillAndCheck();
    expect(await screen.findByTestId("bank-failure")).toHaveTextContent("Could not resolve account");
    expect(screen.queryByTestId("bank-contact-support")).toBeNull();
  });
});

describe("bank helpers", () => {
  it("accountNumberProblem", () => {
    expect(accountNumberProblem("0000000000")).toBeNull();
    expect(accountNumberProblem("123")).toBe("An account number has 10 digits.");
    expect(accountNumberProblem("00000000a0")).not.toBeNull();
  });
  it("bankAccountState", () => {
    expect(bankAccountState(null)).toBe("none");
    expect(bankAccountState({ bank_code: null, verified: false })).toBe("needs_resave");
    expect(bankAccountState({ bank_code: "058", verified: true })).toBe("ready");
  });
  it("payoutsPausedUntil is null for null, past and invalid values", () => {
    const now = Date.parse("2026-10-13T00:00:00Z");
    expect(payoutsPausedUntil(null, now)).toBeNull();
    expect(payoutsPausedUntil("2026-10-12T00:00:00", now)).toBeNull();
    expect(payoutsPausedUntil("nope", now)).toBeNull();
    expect(payoutsPausedUntil("2026-10-13T13:35:26.985349", now)).toBeTruthy();
  });
  it("filterBanks is a case-insensitive contains", () => {
    expect(filterBanks(banks, "MICRO")).toEqual([banks[1]]);
    expect(filterBanks(banks, " ")).toHaveLength(2);
  });
});
