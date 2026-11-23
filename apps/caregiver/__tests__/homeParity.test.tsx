import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import ConfirmDialog from "../src/components/ui/confirm-dialog";
import { greetingLine, HOME_SUBTITLE, monthTitle, partOfDay, timeAgo, weekStrip } from "../src/home/homeBlocks";
import { formatElapsed } from "../src/visit/clockTimer";
import VisitFlow from "../src/screens/visit/VisitFlow";
import { bookingService } from "../src/services/booking.service";
import { carePlansService } from "../src/services/carePlans.service";
import { session } from "../src/auth";
import { visitStarts } from "../src/visit/visitFlow";
import { renderWithClient } from "../test-utils/carePlanHarness";
import { BOOKING, visitPlan } from "../test-utils/carePlanFixtures";

jest.mock("../src/components/StatusBar/FocusedStatusBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

const mockBooking: { value: Record<string, unknown> } = { value: {} };
const mockAct = jest.fn();
jest.mock("../src/hooks/queries", () => ({
  useBooking: () => ({ data: mockBooking.value, isLoading: false, error: null, refetch: jest.fn() }),
  useBookingAction: () => ({ isPending: false, mutate: mockAct }),
}));

describe("Home helpers (Figma wording)", () => {
  it("greets with a comma after the name and a waving hand, and the Figma subtitle", () => {
    expect(greetingLine("Julius")).toBe("Hello Julius, 👋");
    expect(greetingLine(null)).toBe("Hello 👋");
    expect(HOME_SUBTITLE).toBe("What do you like to do today ?");
  });

  it("names the month and shows today with two days either side", () => {
    const wednesday = new Date(2026, 2, 4);
    expect(monthTitle(wednesday)).toBe("March 2026");
    expect(weekStrip(wednesday)).toEqual([
      { label: "Mon", date: 2, isToday: false },
      { label: "Tue", date: 3, isToday: false },
      { label: "Wed", date: 4, isToday: true },
      { label: "Thu", date: 5, isToday: false },
      { label: "Fri", date: 6, isToday: false },
    ]);
  });

  it("rolls the strip over a month end", () => {
    const strip = weekStrip(new Date(2026, 2, 31));
    expect(strip.map((d) => d.date)).toEqual([29, 30, 31, 1, 2]);
  });

  it("says how long ago a notification came", () => {
    const now = Date.parse("2026-10-06T12:00:00Z");
    expect(timeAgo("2026-10-06T11:59:40", now)).toBe("Just now");
    expect(timeAgo("2026-10-06T11:50:00", now)).toBe("10 Min Ago");
    expect(timeAgo("2026-10-06T10:00:00", now)).toBe("2 Hr Ago");
    expect(timeAgo("2026-10-05T12:00:00", now)).toBe("1 Day Ago");
    expect(timeAgo("2026-10-03T12:00:00", now)).toBe("3 Days Ago");
    expect(timeAgo("not a date", now)).toBe("");
  });

  it("picks the part of the day, and nothing when the hour is unknown", () => {
    expect(partOfDay(9)).toBe("morning");
    expect(partOfDay(12)).toBe("afternoon");
    expect(partOfDay(16)).toBe("afternoon");
    expect(partOfDay(17)).toBe("evening");
    expect(partOfDay(Number.NaN)).toBeNull();
  });

  it("formats a running timer", () => {
    expect(formatElapsed(0)).toBe("00:00:00");
    expect(formatElapsed(1000)).toBe("00:00:01");
    expect(formatElapsed((10 * 3600 + 10 * 60) * 1000)).toBe("10:10:00");
    expect(formatElapsed(-5000)).toBe("00:00:00");
  });
});

describe("ConfirmDialog", () => {
  const props = {
    visible: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: "Are you sure?",
    body: "Because.",
    cancelLabel: "No, Go Back",
    confirmLabel: "Yes, Do it",
  };
  beforeEach(() => jest.clearAllMocks());

  it("shows the timer, title, body, a notice and both pills", async () => {
    await render(<ConfirmDialog {...props} timer="00:00:01" notice="Read this first." />);
    expect(screen.getByTestId("dialog-timer")).toHaveTextContent("00:00:01");
    expect(screen.getByText("Are you sure?")).toBeTruthy();
    expect(screen.getByText("Because.")).toBeTruthy();
    expect(screen.getByText("Read this first.")).toBeTruthy();
    expect(screen.getByText("No, Go Back")).toBeTruthy();
    expect(screen.getByText("Yes, Do it")).toBeTruthy();
  });

  it("Close and the safe pill close it; only the outlined pill confirms", async () => {
    await render(<ConfirmDialog {...props} />);
    await fireEvent.press(screen.getByLabelText("Close"));
    await fireEvent.press(screen.getByText("No, Go Back"));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    expect(props.onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Yes, Do it"));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("draws nothing while hidden, and no timer unless asked", async () => {
    const view = await render(<ConfirmDialog {...props} visible={false} />);
    expect(screen.queryByText("Are you sure?")).toBeNull();
    await view.rerender(<ConfirmDialog {...props} />);
    expect(screen.queryByTestId("dialog-timer")).toBeNull();
  });
});

describe("VisitFlow: clock-in dialog and the Clock out shortcut", () => {
  const visit = (status: string) => ({
    status,
    patient_details: { full_name: "Placeholder Client" },
    patient_address: "1 Test Street",
    scheduled_date: "2026-11-08T10:00:00",
    duration_hours: 2,
    channel: "app",
  });
  const renderVisit = (params: { bookingId: string; clockOut?: boolean }) =>
    renderWithClient(
      <VisitFlow
        {...(({ route: { params }, navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() } }) as unknown as React.ComponentProps<typeof VisitFlow>)}
      />,
    );

  beforeEach(async () => {
    visitStarts.clear();
    mockAct.mockClear();
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: null }));
    await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await session.signOut();
  });

  it("asks 'Yes, Clock in' with a 00:00:00 timer before the visit code is sent", async () => {
    mockBooking.value = visit("en_route");
    const act_ = jest.spyOn(bookingService, "act").mockResolvedValue({ status: "in_progress", arrivedAt: null, actualStartTime: "2026-11-08T10:00:00", actualEndTime: null });
    await renderVisit({ bookingId: BOOKING });
    await fireEvent.changeText(await screen.findByTestId("visit-code-input"), "1234");
    await fireEvent.press(screen.getByText("Start visit"));
    expect(screen.getByText("Are you sure you want to clock in to this appointment ?")).toBeTruthy();
    expect(screen.getByTestId("dialog-timer")).toHaveTextContent("00:00:00");
    expect(act_).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Yes, Clock in"));
    expect(act_).toHaveBeenCalledWith(BOOKING, "start", "1234");
  });

  it("'No, Go Back' sends no code", async () => {
    mockBooking.value = visit("en_route");
    const act_ = jest.spyOn(bookingService, "act");
    await renderVisit({ bookingId: BOOKING });
    await fireEvent.changeText(await screen.findByTestId("visit-code-input"), "1234");
    await fireEvent.press(screen.getByText("Start visit"));
    await fireEvent.press(screen.getByText("No, Go Back"));
    expect(act_).not.toHaveBeenCalled();
  });

  it("opens straight on the clock-out dialog when Home's Clock out sent the caregiver here", async () => {
    mockBooking.value = visit("in_progress");
    await renderVisit({ bookingId: BOOKING, clockOut: true });
    expect(await screen.findByText("Are you sure you want to clock out of this appointment ?")).toBeTruthy();
  });

  it("does not open the clock-out dialog on its own when the visit is not in progress", async () => {
    mockBooking.value = visit("en_route");
    await renderVisit({ bookingId: BOOKING, clockOut: true });
    expect(screen.queryByText("Are you sure you want to clock out of this appointment ?")).toBeNull();
  });
});
