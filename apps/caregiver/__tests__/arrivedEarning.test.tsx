import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError, messageForError, isSuspendedStop } from "../src/api/errors";
import { session } from "../src/auth";
import BookingDetails from "../src/screens/booking/BookingDetails";
import VisitFlow from "../src/screens/visit/VisitFlow";
import { OnMyWayStep, VisitCodeStep } from "../src/screens/visit/VisitSteps";
import { bookingService, type Booking } from "../src/services/booking.service";
import { walletService, type CaregiverTransaction } from "../src/services/wallet.service";
import { bookingEarningView, earningMonthFor, findEarningRow, HELD_EARNING_NOTE } from "../src/wallet/bookingEarning";
import { transactionView } from "../src/wallet/walletModel";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));
jest.mock("../src/hooks/useCarePlans", () => ({ useVisitCarePlan: () => ({ data: undefined }) }));
jest.mock("../src/supply/permissionState", () => ({ useLocationPermissions: () => ({ foreground: false }) }));
jest.mock("../src/supply/permissions", () => ({ ensureBackgroundLocation: jest.fn(async () => undefined) }));

const BOOKING_ID = "b7eb9e1b-2edd-4500-b408-ba6f1ccb9195";

/** Placeholder booking shaped after the backend's capture 703/717 (guide, "Your earning, I've arrived..."). */
function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: BOOKING_ID,
    booking_code: "BK-PLACEHOLDER",
    channel: "app",
    patient_id: "p-1",
    patient_details: { patient_id: "p-1", full_name: "Placeholder Patient" },
    caregiver_id: "c-1",
    service_type: "nurse",
    assistance_type: "Placeholder care",
    duration_hours: 2,
    scheduled_date: "2026-11-07T20:00:00",
    scheduled_end_date: "2026-11-07T22:00:00",
    patient_address: "1 Placeholder Street",
    patient_city: "Lagos",
    patient_state: "Lagos",
    status: "accepted",
    payment_status: "paid",
    total_amount: 55000,
    service_fee: 20000,
    platform_fee: 5000,
    booking_for: "self",
    created_at: "2026-11-07T10:00:00",
    updated_at: "2026-11-07T10:00:00",
    arrived_at: null,
    caregiver_earning: 16000,
    ...over,
  } as Booking;
}

function earningRow(over: Partial<CaregiverTransaction> = {}): CaregiverTransaction {
  return {
    id: "t-1",
    type: "earning",
    status: "pending_clearance",
    amount: 1600000,
    booking_id: BOOKING_ID,
    created_at: "2026-11-07T21:50:00",
    ...over,
  } as CaregiverTransaction;
}

describe("earning on Job Details: the model (nothing computed client-side)", () => {
  it("shows the backend number as naira, and nothing when the backend sends null", () => {
    expect(bookingEarningView(booking(), undefined)).toEqual({ amount: "₦16,000.00", statusLabel: null, note: null });
    expect(bookingEarningView(booking({ caregiver_earning: null }), undefined)).toBeNull();
    expect(bookingEarningView(booking({ caregiver_earning: undefined }), undefined)).toBeNull();
  });

  it("a zero earning is still shown (it is a number, not missing)", () => {
    expect(bookingEarningView(booking({ caregiver_earning: 0 }), undefined)?.amount).toBe("₦0.00");
  });

  it("a held earning says Under review with the wallet's wording", () => {
    const view = bookingEarningView(booking({ status: "completed" }), earningRow({ status: "held" }));
    expect(view).toEqual({ amount: "₦16,000.00", statusLabel: "Under review", note: HELD_EARNING_NOTE });
    expect(HELD_EARNING_NOTE).toBe(transactionView(earningRow({ status: "held" })).subtitle);
  });

  it("uses the same status words as the wallet list for every earning status", () => {
    for (const status of ["pending_clearance", "held", "successful", "voided"]) {
      const row = earningRow({ status });
      expect(bookingEarningView(booking({ status: "completed" }), row)?.statusLabel).toBe(transactionView(row).statusLabel);
    }
  });

  it("a normal completed visit shows its status but no review note", () => {
    const view = bookingEarningView(booking({ status: "completed" }), earningRow());
    expect(view?.statusLabel).toBe("Pending");
    expect(view?.note).toBeNull();
  });

  it("looks the wallet row up only for a completed visit that has an earning", () => {
    const completed = booking({ status: "completed", updated_at: "2026-11-07T21:50:00" });
    expect(earningMonthFor(completed)).toBe("2026-11");
    expect(earningMonthFor(booking({ status: "in_progress" }))).toBeNull();
    expect(earningMonthFor({ ...completed, caregiver_earning: null })).toBeNull();
  });

  it("picks this booking's earning row, not another booking's or a late-cancel payment", () => {
    const rows = [
      earningRow({ id: "a", booking_id: "other" }),
      earningRow({ id: "b", type: "late_cancel_compensation" }),
      earningRow({ id: "c" }),
    ];
    expect(findEarningRow(rows, BOOKING_ID)?.id).toBe("c");
    expect(findEarningRow(undefined, BOOKING_ID)).toBeUndefined();
  });
});

describe("I've arrived: error sentences (exact backend strings)", () => {
  const map = (status: number, detail: string) => messageForError(new ApiError(status, { detail }, "x"), "visit");

  it.each([
    [409, "Only an accepted booking can be marked as arrived", "This visit has already moved past this step. We've refreshed it."],
    [403, "This booking is not assigned to you", "This visit isn't assigned to you."],
    [403, "Access denied. Caregiver account required.", "This app is for caregivers. Please use the correct app for your account."],
  ])("%i %s", (status, detail, expected) => expect(map(status, detail)).toBe(expected));

  it("a suspended caregiver is stopped, as for start", () => {
    const error = new ApiError(403, { detail: "Your account is not approved to start visits" }, "x");
    expect(isSuspendedStop(error)).toBe(true);
  });

  it("offline reads as a network problem", () => {
    expect(messageForError(new ApiError(0, null, "x"), "visit")).toBe("Can't reach Oakly. Check your internet connection and try again.");
  });
});

describe("arrival UI pieces", () => {
  const visit = { patientName: "Placeholder Patient", address: "1 Placeholder Street", when: "later" };
  const codeProps = { visit, busy: false, lockedUntil: null, attemptsLeft: null, error: null, onSubmit: jest.fn() };

  it("the code step offers I've arrived until arrived_at is set, then shows the done state and hides the button", async () => {
    const onArrived = jest.fn();
    const view = await render(<VisitCodeStep {...codeProps} arrival={{ arrived: false, busy: false, onArrived }} />);
    await fireEvent.press(screen.getByText("I've arrived"));
    expect(onArrived).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("arrived-notice")).toBeNull();

    await view.rerender(<VisitCodeStep {...codeProps} arrival={{ arrived: true, busy: false, onArrived }} />);
    expect(screen.getByTestId("arrived-notice")).toBeTruthy();
    expect(screen.queryByText("I've arrived")).toBeNull();
  });

  it("the code step has no arrival UI when none is passed", async () => {
    await render(<VisitCodeStep {...codeProps} />);
    expect(screen.queryByText("I've arrived")).toBeNull();
    expect(screen.queryByTestId("arrived-notice")).toBeNull();
  });

  it("the first step offers a way on to the code only after an arrival failure", async () => {
    const props = {
      visit,
      scheduledDate: "2026-11-07T20:00:00",
      busy: false,
      onOnMyWay: jest.fn(),
      onArrived: jest.fn(),
      channel: "app",
      onCantMakeIt: jest.fn(),
      onContactSupport: jest.fn(),
    };
    const onSkip = jest.fn();
    const view = await render(<OnMyWayStep {...props} />);
    expect(screen.queryByTestId("skip-to-code")).toBeNull();
    await view.rerender(<OnMyWayStep {...props} onSkipToCode={onSkip} />);
    await fireEvent.press(screen.getByTestId("skip-to-code"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

const clients: QueryClient[] = [];
function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: {
      // gcTime 0: an unobserved query or mutation is dropped at once, so no 5-minute gc timer keeps a
      // single-worker Jest (as CI runs it) alive after the last test.
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  mockNavigate.mockClear();
});
afterEach(async () => {
  // Unmount first: a mounted observer re-arms its poll and gc timers on a cleared client, and a
  // single-worker Jest (as CI runs it) would then never exit.
  await cleanup();
  clients.splice(0).forEach((c) => c.clear());
  jest.restoreAllMocks();
});

const detailsProps = {
  route: { params: { bookingId: BOOKING_ID } },
  navigation: { navigate: mockNavigate, replace: jest.fn(), goBack: jest.fn() },
} as unknown as React.ComponentProps<typeof BookingDetails>;

describe("Job Details shows the caregiver's own earning", () => {
  it("an accepted booking: the amount, no status line, no wallet lookup", async () => {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking());
    const wallet = jest.spyOn(walletService, "getTransactions");
    await renderScreen(<BookingDetails {...detailsProps} />);
    expect(await screen.findByTestId("booking-earning-amount")).toHaveTextContent("₦16,000.00");
    expect(screen.queryByTestId("booking-earning-status")).toBeNull();
    expect(wallet).not.toHaveBeenCalled();
  });

  it("no earning row when the backend sends null (nothing invented)", async () => {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking({ caregiver_earning: null }));
    await renderScreen(<BookingDetails {...detailsProps} />);
    expect(await screen.findByText("Job Details")).toBeTruthy();
    await screen.findByText("Placeholder Patient");
    expect(screen.queryByTestId("booking-earning")).toBeNull();
  });

  it("a completed normal visit says Pending", async () => {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking({ status: "completed" }));
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([earningRow()]);
    await renderScreen(<BookingDetails {...detailsProps} />);
    await waitFor(() => expect(screen.getByTestId("booking-earning-status")).toHaveTextContent("Pending"));
    expect(screen.queryByTestId("booking-earning-note")).toBeNull();
  });

  it("a completed short visit says Under review and why", async () => {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking({ status: "completed" }));
    jest.spyOn(walletService, "getTransactions").mockResolvedValue([earningRow({ status: "held" })]);
    await renderScreen(<BookingDetails {...detailsProps} />);
    await waitFor(() => expect(screen.getByTestId("booking-earning-status")).toHaveTextContent("Under review"));
    expect(screen.getByTestId("booking-earning-note")).toHaveTextContent(HELD_EARNING_NOTE);
    expect(screen.getByTestId("booking-earning-amount")).toHaveTextContent("₦16,000.00");
  });

  it("still shows the amount when the wallet lookup fails", async () => {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking({ status: "completed" }));
    jest.spyOn(walletService, "getTransactions").mockRejectedValue(new ApiError(0, null, "x"));
    await renderScreen(<BookingDetails {...detailsProps} />);
    expect(await screen.findByTestId("booking-earning-amount")).toHaveTextContent("₦16,000.00");
    expect(screen.queryByTestId("booking-earning-status")).toBeNull();
  });

  it("an offer (no earning yet) shows none", async () => {
    const offerProps = {
      ...detailsProps,
      route: {
        params: {
          bookingId: BOOKING_ID,
          offer: { id: BOOKING_ID, serviceType: "nurse", assistanceType: null, durationHours: 2, scheduledDate: "2026-11-07T20:00:00", scheduledEndDate: "2026-11-07T22:00:00", area: "Lagos, Lagos" },
        },
      },
    } as unknown as React.ComponentProps<typeof BookingDetails>;
    await renderScreen(<BookingDetails {...offerProps} />);
    expect(screen.queryByTestId("booking-earning")).toBeNull();
  });
});

describe("the visit screen: I've arrived", () => {
  const flowProps = {
    route: { params: { bookingId: BOOKING_ID } },
    navigation: { navigate: mockNavigate, popTo: jest.fn(), goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof VisitFlow>;

  /** A fake backend: `arrived` stamps arrived_at once and keeps it on a repeat. */
  function fakeBackend(initial: Partial<Booking> = {}) {
    let current = booking(initial);
    jest.spyOn(bookingService, "getBooking").mockImplementation(async () => current);
    const act = jest.spyOn(bookingService, "act").mockImplementation(async (_id, action) => {
      if (action === "arrived") {
        current = { ...current, arrived_at: current.arrived_at ?? "2026-11-07T21:43:15.761844" };
        return { status: current.status, arrivedAt: current.arrived_at ?? null, actualStartTime: null, actualEndTime: null };
      }
      return { status: current.status, arrivedAt: null, actualStartTime: null, actualEndTime: null };
    });
    return act;
  }

  it("tapping sends `arrived`, then shows the done state and no button", async () => {
    const act = fakeBackend();
    await renderScreen(<VisitFlow {...flowProps} />);
    await fireEvent.press(await screen.findByText("I've arrived"));
    expect(act).toHaveBeenCalledWith(BOOKING_ID, "arrived", undefined);
    expect(await screen.findByTestId("arrived-notice")).toBeTruthy();
    expect(screen.queryByText("I've arrived")).toBeNull();
    // The code entry is there: arrival never replaces it.
    expect(screen.getByTestId("visit-code-input")).toBeTruthy();
  });

  it("after a reload an already-arrived booking comes up in the done state", async () => {
    fakeBackend({ arrived_at: "2026-11-07T21:43:15.761844" });
    await renderScreen(<VisitFlow {...flowProps} />);
    expect(await screen.findByTestId("arrived-notice")).toBeTruthy();
    expect(screen.queryByText("I've arrived")).toBeNull();
  });

  it("an en-route visit that has not arrived offers the button above the code", async () => {
    const act = fakeBackend({ status: "en_route" });
    await renderScreen(<VisitFlow {...flowProps} />);
    await fireEvent.press(await screen.findByText("I've arrived"));
    await waitFor(() => expect(screen.getByTestId("arrived-notice")).toBeTruthy());
    expect(act).toHaveBeenCalledWith(BOOKING_ID, "arrived", undefined);
  });

  it("a 409 shows the sentence from the backend's detail and keeps the button", async () => {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking());
    jest
      .spyOn(bookingService, "act")
      .mockRejectedValue(new ApiError(409, { detail: "Only an accepted booking can be marked as arrived" }, "x"));
    await renderScreen(<VisitFlow {...flowProps} />);
    await fireEvent.press(await screen.findByText("I've arrived"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Couldn't tell the patient", "This visit has already moved past this step. We've refreshed it."),
    );
    expect(screen.getByText("I've arrived")).toBeTruthy();
  });

  it("when the call fails the caregiver can still go on to the visit code", async () => {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking());
    jest.spyOn(bookingService, "act").mockRejectedValue(new ApiError(0, null, "x"));
    await renderScreen(<VisitFlow {...flowProps} />);
    await fireEvent.press(await screen.findByText("I've arrived"));
    await fireEvent.press(await screen.findByTestId("skip-to-code"));
    expect(await screen.findByTestId("visit-code-input")).toBeTruthy();
    expect(screen.queryByTestId("arrived-notice")).toBeNull();
  });
});
