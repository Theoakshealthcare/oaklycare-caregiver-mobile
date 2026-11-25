import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, waitFor, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Keyboard, Linking, StyleSheet } from "react-native";

import { ApiError } from "../src/api/errors";
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
const resolved = {
  account_name: "PLACEHOLDER CAREGIVER A",
  account_number: "0000000000",
  bank_code: "058",
  bank_name: "Placeholder Bank",
  needs_review: false,
};
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

/** "Update Payment Details" is both the page title and Figma's button: the button is the last one on screen. */
async function pressUpdate() {
  const matches = await screen.findAllByText("Update Payment Details");
  await fireEvent.press(matches[matches.length - 1]!);
}

async function fillAndCheck() {
  await fireEvent.press(await screen.findByLabelText("Choose Bank"));
  await fireEvent.press(await screen.findByText("Placeholder Bank"));
  await fireEvent.changeText(screen.getByPlaceholderText("10 digits"), "0000000000");
  await pressUpdate();
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

describe("bank picker modal (Figma 8.15.33)", () => {
  it("is a card titled Select Bank with Close and a Search bank field; Close dismisses it", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Choose Bank"));
    expect(await screen.findByPlaceholderText("Search bank")).toBeTruthy();
    expect(screen.getAllByText("Select Bank").length).toBe(2); // the field's label and the card's title
    expect(screen.getByText("Close")).toBeTruthy();
    // jest's safe-area mock has a zero top inset: the card starts a fixed gap below the inset.
    expect(screen.getByTestId("bank-picker").props.style.paddingTop).toBe(60);
    await fireEvent.press(screen.getByLabelText("Close bank list"));
    await waitFor(() => expect(screen.queryByPlaceholderText("Search bank")).toBeNull());
  });

  it("picking a bank shows its name in the field", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Choose Bank"));
    await fireEvent.press(await screen.findByText("Placeholder Bank"));
    await waitFor(() => expect(screen.queryByPlaceholderText("Search bank")).toBeNull());
    expect(screen.getByText("Placeholder Bank")).toBeTruthy();
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
    expect(await screen.findByText("Select Bank")).toBeTruthy();
    expect(screen.getByText("Enter Account Details")).toBeTruthy();
    expect(screen.getByText("Account Name")).toBeTruthy();
    expect(screen.getAllByText("Update Payment Details").length).toBe(2); // the title and the button
    expect(screen.queryByText("Check account")).toBeNull();
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
    await pressUpdate();
    expect(screen.getByText("Choose a bank from the list.")).toBeTruthy();
    expect(screen.getByText("An account number has 10 digits.")).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("resolve success: shows the account name to confirm", async () => {
    const resolve = jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(resolved);
    await renderScreen();
    await fillAndCheck();
    // Figma's Account Name field fills in with the name the bank gives, for the caregiver to confirm.
    expect(await screen.findByDisplayValue("PLACEHOLDER CAREGIVER A")).toBeTruthy();
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
    expect(await screen.findByText("Enter Account Details")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancel"));
    expect(await screen.findByText("PLACEHOLDER CAREGIVER A")).toBeTruthy();
  });

  it("bank picker: searches the list and shows a retry when it fails to load", async () => {
    jest.spyOn(walletService, "getBanks").mockRejectedValueOnce(new ApiError(0, null, "x")).mockResolvedValue(banks);
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Choose Bank"));
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    await fireEvent.changeText(screen.getByPlaceholderText("Search bank"), "micro");
    expect(await screen.findByText("Sample Microfinance Bank")).toBeTruthy();
    expect(screen.queryByText("Placeholder Bank")).toBeNull();
  });
});

// A holder name that does not look like the profile name is saved but held (backend `needs_review`, `name_review_status`):
// the lookup shows the name masked, the caregiver can still save, and Finance approves or rejects the account.
// Shapes follow the backend tests, not a live capture (placeholder data only).
const flagged = { ...resolved, account_name: "P******** C********* A", needs_review: true };

describe("bank account holder name that is not the profile name", () => {
  it("warns at the lookup step, offers to save for review, and saves", async () => {
    jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(flagged);
    const update = jest.spyOn(walletService, "updateBankAccount").mockResolvedValue({ ...saved, name_review_status: "pending" });
    await renderScreen();
    await fillAndCheck();

    expect(await screen.findByTestId("bank-needs-review")).toHaveTextContent(/only pay into it after our team has checked it/);
    expect(screen.queryByTestId("bank-failure")).toBeNull();
    expect(screen.queryByText("Yes, this is my account")).toBeNull();
    await fireEvent.press(screen.getByText("Save for review"));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ bank_code: "058", account_number: "0000000000" }));
    expect(await screen.findByTestId("bank-saved-notice")).toHaveTextContent(/our team will check it before we pay into it/);
  });

  it("shows no warning when the name matches", async () => {
    jest.spyOn(walletService, "resolveBankAccount").mockResolvedValue(resolved);
    await renderScreen();
    await fillAndCheck();
    expect(await screen.findByText("Yes, this is my account")).toBeTruthy();
    expect(screen.queryByTestId("bank-needs-review")).toBeNull();
  });

  it("tells the caregiver an account is waiting for review", async () => {
    jest.spyOn(walletService, "getBankAccount").mockResolvedValue({ ...saved, name_review_status: "pending" });
    await renderScreen();
    expect(await screen.findByTestId("bank-name-pending")).toHaveTextContent(/checking that this account is yours/);
    expect(screen.queryByTestId("bank-contact-support")).toBeNull();
  });

  it("tells the caregiver a rejected account cannot be paid, with a Contact support link", async () => {
    jest.spyOn(walletService, "getBankAccount").mockResolvedValue({ ...saved, name_review_status: "rejected" });
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderScreen();
    expect(await screen.findByTestId("bank-name-rejected")).toHaveTextContent(/cannot pay into it/);
    await fireEvent.press(screen.getByTestId("bank-contact-support"));
    expect(open).toHaveBeenCalledWith(supportUrl());
  });

  it("says nothing about review for an approved account or a matched one", async () => {
    jest.spyOn(walletService, "getBankAccount").mockResolvedValue({ ...saved, name_review_status: "approved" });
    await renderScreen();
    await screen.findByText("PLACEHOLDER CAREGIVER A");
    expect(screen.queryByTestId("bank-name-pending")).toBeNull();
    expect(screen.queryByTestId("bank-name-rejected")).toBeNull();
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
