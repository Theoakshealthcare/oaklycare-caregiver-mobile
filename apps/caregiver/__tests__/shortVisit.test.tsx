import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { session } from "../src/auth";
import VisitFlow from "../src/screens/visit/VisitFlow";
import { carePlansService } from "../src/services/carePlans.service";
import { isShortVisit, SHORT_VISIT_CONFIRM_MESSAGE, SHORT_VISIT_MIN_PERCENT, shortVisitDoneMessage } from "../src/visit/visitFlow";
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

// A 4 hour booking that started at 10:00 UTC: the half-way mark is 12:00 UTC. The backend sends naive UTC.
const STARTED = "2026-11-08T10:00:00";
const at = (isoUtc: string) => () => Date.parse(`${isoUtc}Z`);

const inProgress = (extra: Record<string, unknown> = {}) => ({
  status: "in_progress",
  patient_details: { full_name: "Placeholder Client" },
  patient_address: "1 Test Street",
  scheduled_date: STARTED,
  duration_hours: 4,
  actual_start_time: STARTED,
  channel: "app",
  ...extra,
});

beforeEach(async () => {
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

describe("Complete tap: confirm dialog", () => {
  it("warns that pay is held when less than half of the booked time was on site", async () => {
    mockBooking.value = inProgress();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderVisit(at("2026-11-08T10:30:00")); // 30 minutes of 4 hours
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe("Complete this visit?");
    expect(alert.mock.calls[0][1]).toBe(
      "You have been on site for less than half of the booked time. If you complete now, your pay for this visit is held for Finance review.",
    );
    expect(alert.mock.calls[0][1]).toBe(SHORT_VISIT_CONFIRM_MESSAGE);
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(buttons.map((b) => b.text)).toEqual(["Not yet", "Complete"]);
    buttons[1].onPress?.();
    expect(mockAct).toHaveBeenCalledWith({ bookingId: BOOKING, action: "complete" }, expect.anything());
  });

  it("keeps today's dialog once half of the booked time has passed", async () => {
    mockBooking.value = inProgress();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderVisit(at("2026-11-08T12:00:00")); // exactly half
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(alert.mock.calls[0][0]).toBe("Complete this visit?");
    expect(alert.mock.calls[0][1]).toMatch(/^This ends the visit/);
    expect(alert.mock.calls[0][1]).not.toMatch(/Finance/);
  });

  it("keeps today's dialog when the booking has no recorded start", async () => {
    mockBooking.value = inProgress({ actual_start_time: null });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderVisit(at("2026-11-08T10:01:00"));
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(alert.mock.calls[0][1]).not.toMatch(/Finance/);
  });
});

describe("Result screen after completing", () => {
  const completed = (end: string, extra: Record<string, unknown> = {}) => ({
    ...inProgress(),
    status: "completed",
    actual_end_time: end,
    caregiver_earning: 40000,
    ...extra,
  });

  it("says the earning is under review for a short visit, with the real amount", async () => {
    mockBooking.value = completed("2026-11-08T10:05:00");
    await renderVisit(at("2026-11-08T10:06:00"));
    expect(await screen.findByText("Visit completed")).toBeTruthy();
    expect(screen.getByText(/^Your ₦40,000(\.00)? is under review by Finance, and we will tell you when it is decided\./)).toBeTruthy();
    expect(screen.queryByText(/Thank you/)).toBeNull();
  });

  it("says 'your earning' when the booking carries no amount", async () => {
    mockBooking.value = completed("2026-11-08T10:05:00", { caregiver_earning: null });
    await renderVisit(at("2026-11-08T10:06:00"));
    expect(await screen.findByText("Your earning is under review by Finance, and we will tell you when it is decided.")).toBeTruthy();
    expect(shortVisitDoneMessage(null)).toBe("Your earning is under review by Finance, and we will tell you when it is decided.");
  });

  it("keeps 'Thank you' for a normal visit", async () => {
    mockBooking.value = completed("2026-11-08T14:00:00");
    await renderVisit(at("2026-11-08T14:01:00"));
    await waitFor(() => expect(screen.getByText("Visit completed")).toBeTruthy());
    expect(screen.getByText(/^Thank you\./)).toBeTruthy();
    expect(screen.queryByText(/under review/)).toBeNull();
  });
});
