import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { session } from "../src/auth";
import VisitFlow from "../src/screens/visit/VisitFlow";
import { carePlansService } from "../src/services/carePlans.service";
import { bookingService } from "../src/services/booking.service";
import {
  createVisitStarts,
  isShortVisit,
  SHORT_VISIT_CONFIRM_MESSAGE,
  SHORT_VISIT_MIN_PERCENT,
  shortVisitDoneMessage,
  submitVisitCode,
  visitStarts,
} from "../src/visit/visitFlow";
import { renderWithClient } from "../test-utils/carePlanHarness";
import { BOOKING, visitPlan } from "../test-utils/carePlanFixtures";

jest.mock("../src/components/StatusBar/FocusedStatusBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

// The booking the screen reads; each test sets the parts it cares about.
const mockBooking: { value: Record<string, unknown> } = { value: {} };
const mockAct = jest.fn();
jest.mock("../src/hooks/queries", () => ({
  useBooking: () => ({ data: mockBooking.value, isLoading: false, error: null, refetch: jest.fn() }),
  useBookingAction: () => ({ isPending: false, mutate: mockAct }),
}));

// A 4 hour booking whose visit started at 10:00 UTC: the half-way mark is 12:00 UTC. The backend sends naive UTC.
// The booking the screen reads has NO actual times (the booking GET does not carry them): the app learns the start
// from the `start` answer and the end from the `complete` answer.
const STARTED = "2026-11-08T10:00:00";
const at = (isoUtc: string) => () => Date.parse(`${isoUtc}Z`);

const inProgress = (extra: Record<string, unknown> = {}) => ({
  status: "in_progress",
  patient_details: { full_name: "Placeholder Client" },
  patient_address: "1 Test Street",
  scheduled_date: STARTED,
  duration_hours: 4,
  channel: "app",
  ...extra,
});

beforeEach(async () => {
  visitStarts.clear();
  jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: null }));
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockAct.mockClear();
  await session.signOut();
});

const renderVisit = (now: () => number) =>
  renderWithClient(
    <VisitFlow
      {...(({ route: { params: { bookingId: BOOKING } }, navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }, now }) as unknown as React.ComponentProps<typeof VisitFlow>)}
    />,
  );

describe("isShortVisit (the backend rule)", () => {
  const H = 3_600_000;
  const start = Date.parse("2026-11-08T10:00:00Z");

  it("uses the backend default of 50 percent", () => {
    expect(SHORT_VISIT_MIN_PERCENT).toBe(50);
  });

  it("is short only strictly under the minimum share of the booked time", () => {
    expect(isShortVisit(start, start + 2 * H - 1, 4)).toBe(true);
    expect(isShortVisit(start, start + 2 * H, 4)).toBe(false); // exactly half is not short
    expect(isShortVisit(start, start + 3 * H, 4)).toBe(false);
    expect(isShortVisit(start, start, 4)).toBe(true);
  });

  it("follows a different policy percentage when one is given", () => {
    expect(isShortVisit(start, start + 2 * H, 4, 60)).toBe(true);
    expect(isShortVisit(start, start + 2 * H, 4, 40)).toBe(false);
  });

  it("is never short when the start or the booked duration is unknown", () => {
    expect(isShortVisit(null, start + H, 4)).toBe(false);
    expect(isShortVisit(Number.NaN, start + H, 4)).toBe(false);
    expect(isShortVisit(start, start + H, 0)).toBe(false);
    expect(isShortVisit(start, start + H, null)).toBe(false);
  });
});

describe("Complete tap: clock-out dialog", () => {
  it("warns that pay is held when less than half of the booked time was on site", async () => {
    mockBooking.value = inProgress();
    visitStarts.record(BOOKING, STARTED);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderVisit(at("2026-11-08T10:30:00")); // 30 minutes of 4 hours
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(alert).not.toHaveBeenCalled(); // the Figma dialog replaced the native alert
    expect(screen.getByText("Are you sure you want to clock out of this appointment ?")).toBeTruthy();
    expect(screen.getByTestId("dialog-notice")).toHaveTextContent(SHORT_VISIT_CONFIRM_MESSAGE);
    expect(SHORT_VISIT_CONFIRM_MESSAGE).toBe(
      "You have been on site for less than half of the booked time. If you complete now, your pay for this visit is held for Finance review.",
    );
    expect(mockAct).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Yes, Clock out"));
    expect(mockAct).toHaveBeenCalledWith({ bookingId: BOOKING, action: "complete" }, expect.anything());
  });

  it("shows the time on site as a running timer in the dialog", async () => {
    mockBooking.value = inProgress();
    visitStarts.record(BOOKING, STARTED);
    await renderVisit(at("2026-11-08T20:10:00")); // 10 h 10 min after the start
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(screen.getByTestId("dialog-timer")).toHaveTextContent("10:10:00");
  });

  it("keeps the plain notice once half of the booked time has passed", async () => {
    mockBooking.value = inProgress();
    visitStarts.record(BOOKING, STARTED);
    await renderVisit(at("2026-11-08T12:00:00")); // exactly half
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(screen.getByTestId("dialog-notice")).toHaveTextContent(/^This ends the visit/);
    expect(screen.getByTestId("dialog-notice")).not.toHaveTextContent(/Finance/);
  });

  it("shows no timer, and no invented one, when the app never saw the start (a visit resumed after a restart)", async () => {
    mockBooking.value = inProgress();
    await renderVisit(at("2026-11-08T10:01:00"));
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(screen.queryByTestId("dialog-timer")).toBeNull();
    expect(screen.getByTestId("dialog-notice")).not.toHaveTextContent(/Finance/);
  });
});

describe("the start the app remembers", () => {
  it("records the start the `start` answer reports, and nothing else", async () => {
    const starts = createVisitStarts();
    starts.record("b1", "2026-11-08T10:00:00");
    starts.record("b2", null);
    starts.record("b3", "not a date");
    expect(starts.get("b1")).toBe(Date.parse("2026-11-08T10:00:00Z"));
    expect(starts.get("b2")).toBeNull();
    expect(starts.get("b3")).toBeNull();
  });

  it("is filled when the visit code is accepted", async () => {
    jest.spyOn(bookingService, "act").mockResolvedValue({
      status: "in_progress",
      arrivedAt: null,
      actualStartTime: STARTED,
      actualEndTime: null,
    });
    mockBooking.value = { ...inProgress(), status: "en_route" };
    const result = await submitVisitCode(BOOKING, "1234", {
      start: async (id, code) => {
        const answer = await bookingService.act(id, "start", code);
        visitStarts.record(id, answer.actualStartTime);
        return answer;
      },
    });
    expect(result).toEqual({ kind: "started" });
    expect(visitStarts.get(BOOKING)).toBe(Date.parse(`${STARTED}Z`));
  });
});

describe("Result screen after completing", () => {
  /** Confirms the clock-out dialog and plays the backend's `complete` answer back to the screen. */
  const complete = async (answer: { actualStartTime: string | null; actualEndTime: string | null }, booking: Record<string, unknown>) => {
    mockBooking.value = inProgress();
    await renderVisit(at("2026-11-08T14:00:00"));
    await fireEvent.press(await screen.findByText("Complete visit"));
    await fireEvent.press(screen.getByText("Yes, Clock out"));
    expect(mockAct).toHaveBeenCalledTimes(1);
    const options = mockAct.mock.calls[0][1] as { onSuccess: (result: unknown) => void };
    // The booking is refetched as completed; the answer carries the two instants the backend judged.
    mockBooking.value = { ...inProgress(), status: "completed", caregiver_earning: 40000, ...booking };
    await act(async () => options.onSuccess({ status: "completed", arrivedAt: null, ...answer }));
  };

  it("says the earning is under review for a short visit, with the real amount", async () => {
    await complete({ actualStartTime: STARTED, actualEndTime: "2026-11-08T10:05:00" }, {});
    expect(await screen.findByText("You have successfully clocked out of your appointment")).toBeTruthy();
    expect(screen.getByText(/^Your ₦40,000(\.00)? is under review by Finance, and we will tell you when it is decided\./)).toBeTruthy();
    expect(screen.queryByText(/Thank you/)).toBeNull();
  });

  it("says 'your earning' when the booking carries no amount", async () => {
    await complete({ actualStartTime: STARTED, actualEndTime: "2026-11-08T10:05:00" }, { caregiver_earning: null });
    expect(await screen.findByText("Your earning is under review by Finance, and we will tell you when it is decided.")).toBeTruthy();
    expect(shortVisitDoneMessage(null)).toBe("Your earning is under review by Finance, and we will tell you when it is decided.");
  });

  it("keeps 'Thank you' for a normal visit", async () => {
    await complete({ actualStartTime: STARTED, actualEndTime: "2026-11-08T14:00:00" }, {});
    await waitFor(() => expect(screen.getByText("You have successfully clocked out of your appointment")).toBeTruthy());
    expect(screen.getByText(/^Thank you\./)).toBeTruthy();
    expect(screen.queryByText(/under review/)).toBeNull();
  });

  it("keeps 'Thank you' when the answer carries no times to judge", async () => {
    await complete({ actualStartTime: null, actualEndTime: null }, {});
    await waitFor(() => expect(screen.getByText(/^Thank you\./)).toBeTruthy());
  });
});
