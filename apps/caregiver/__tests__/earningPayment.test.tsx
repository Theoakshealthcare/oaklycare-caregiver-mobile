import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import EarningPayment from "../src/screens/account/EarningPayment";
import PayslipDownloaded, { PAYSLIP_BODY, payslipTitle } from "../src/screens/account/PayslipDownloaded";
import { walletService, type CaregiverTransaction } from "../src/services/wallet.service";
import { currentMonth, monthName, monthOptions } from "../src/wallet/walletModel";

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
const mockSharePayslip = jest.fn();
jest.mock("../src/wallet/payslip", () => ({ sharePayslip: (...args: unknown[]) => mockSharePayslip(...args) }));

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

async function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

let alertSpy: jest.SpyInstance;
beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockSharePayslip.mockReset();
  await act(async () => {
    await session.signOut();
  });
});

describe("Earning Payment screen", () => {
  it("is titled Earning Payment with the month chip, and shows a spinner while loading", async () => {
    jest.spyOn(walletService, "getTransactions").mockReturnValue(new Promise(() => undefined));
    await renderWith(<EarningPayment />);
    expect(screen.getByText("Earning Payment")).toBeTruthy();
    expect(screen.getByTestId("month-chip")).toHaveTextContent(monthName(currentMonth()));
    expect(screen.getByTestId("transactions-loading")).toBeTruthy();
  });

  it("shows the empty state for a month with no payments", async () => {
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<EarningPayment />);
    expect(await screen.findByText("No payments this month")).toBeTruthy();
  });

  it("shows the error with a retry", async () => {
    const get = jest
      .spyOn(walletService, "getTransactions")
      .mockRejectedValueOnce(new ApiError(0, null, "x"))
      .mockResolvedValue([]);
    await renderWith(<EarningPayment />);
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("No payments this month")).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("lists the transactions grouped by date and shows a pending withdrawal as requested", async () => {
    const getTx = jest.spyOn(walletService, "getTransactions").mockResolvedValue([
      tx({}),
      tx({ id: "t2", type: "earning", status: "successful", amount: 5500000, narration: "Visit ECCADB9F", reference: "REF1" }),
    ]);
    await renderWith(<EarningPayment />);
    expect(await screen.findByText("Today")).toBeTruthy();
    expect(screen.getByText("Withdrawal requested")).toBeTruthy();
    expect(screen.getByText("-₦2,000.00")).toBeTruthy();
    expect(screen.getByText("Visit ECCADB9F")).toBeTruthy();
    expect(screen.getByText("+₦55,000.00")).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy(); // an earning that has cleared; a paid-out withdrawal reads Successful
    expect(getTx).toHaveBeenCalledWith(currentMonth());
  });

  it("labels a held visit earning 'Under review' in the list, with why (short-visit hold)", async () => {
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([
      tx({ id: "t3", type: "earning", status: "held", amount: 2000000, narration: "Visit HOLD1234", reference: null }),
    ]);
    await renderWith(<EarningPayment />);
    expect(await screen.findByText("Visit HOLD1234")).toBeTruthy();
    expect(screen.getByText("Under review")).toBeTruthy();
    expect(screen.getByText("Oakly is reviewing this visit before it is paid")).toBeTruthy();
  });

  it("the month chip lists the months and loads the one picked", async () => {
    const get = jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<EarningPayment />);
    await screen.findByText("No payments this month");
    const previous = monthOptions()[1]!;
    await fireEvent.press(screen.getByLabelText("Choose month"));
    await fireEvent.press(await screen.findByText(previous.label));
    await waitFor(() => expect(get).toHaveBeenCalledWith(previous.value));
    expect(screen.getByTestId("month-chip")).toHaveTextContent(monthName(previous.value));
  });

  it("shares the payslip of the selected month, then opens the success page for that month", async () => {
    const rows = [tx({ id: "t9", type: "earning", status: "held", amount: 4000000, narration: "Visit HELD0003", reference: null })];
    jest.spyOn(walletService, "getTransactions").mockResolvedValue(rows);
    mockSharePayslip.mockResolvedValue(undefined);
    await renderWith(<EarningPayment />);
    await screen.findByText("Visit HELD0003");
    await fireEvent.press(await screen.findByText("Download Payslip"));
    await waitFor(() => expect(mockSharePayslip).toHaveBeenCalledWith(currentMonth(), rows));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("PayslipDownloaded", { month: currentMonth() }));
  });

  it("says so, before sharing anything, when the month has no payments", async () => {
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([]);
    await renderWith(<EarningPayment />);
    await screen.findByText("No payments this month");
    await fireEvent.press(await screen.findByText("Download Payslip"));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/^No earnings in /), expect.stringContaining("nothing to put in a payslip"));
    expect(mockSharePayslip).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("tells the caregiver when the payslip could not be shared, and shows no success page", async () => {
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([tx({ type: "earning", status: "successful" })]);
    mockSharePayslip.mockRejectedValue(new ApiError(0, null, "x"));
    await renderWith(<EarningPayment />);
    await screen.findByText("Placeholder");
    await fireEvent.press(await screen.findByText("Download Payslip"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't get your payslip", expect.stringContaining("Can't reach Oakly")));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("Payslip downloaded page", () => {
  const props = { route: { params: { month: "2026-04" } } } as unknown as React.ComponentProps<typeof PayslipDownloaded>;

  it("says the month's payslip was downloaded, in the shared success look, and Close goes back", async () => {
    await render(<PayslipDownloaded {...props} />);
    expect(screen.getByText("April Payslip Downloaded Successfully")).toBeTruthy();
    expect(screen.getByText("Your Payslip has been downloaded successfully.")).toBeTruthy();
    expect(screen.getByTestId("success-illustration")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("builds its words from the month", () => {
    expect(payslipTitle("2026-11")).toBe("November Payslip Downloaded Successfully");
    expect(PAYSLIP_BODY).toBe("Your Payslip has been downloaded successfully.");
  });
});
