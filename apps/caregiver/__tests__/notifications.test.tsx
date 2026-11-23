import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { session } from "../src/auth";
import { ApiError } from "../src/api/errors";
import Notifications from "../src/screens/account/Notifications";
import { notificationService, type CaregiverNotification } from "../src/services/notification.service";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

// Shaped after capture 074 in the backend guide (an offer view: no caregiver assigned yet).
const notification: CaregiverNotification = {
  id: "c9eac737-4195-4d97-b475-6e55869b54da",
  booking_id: "1b4b008b-c4d2-4fb1-a7b6-1eca61375802",
  title: "New Booking Request",
  message: "New nurse request - 0.0km away, ETA 5 min",
  notification_type: "new_booking",
  is_read: false,
  created_at: "2026-10-06T08:23:27.927274",
  response: null,
  booking: {
    id: "1b4b008b-c4d2-4fb1-a7b6-1eca61375802",
    booking_code: "2DC38733",
    channel: "whatsapp",
    patient_id: "d6439478-3aa3-40c0-ae01-4545fe16d585",
    patient_details: null,
    caregiver_id: null,
    caregiver_details: null,
    service_type: "nurse",
    assistance_type: "Placeholder assistance",
    condition: null,
    duration_hours: 2,
    duration_minutes: 120,
    scheduled_date: "2026-10-06T08:38:27.858997",
    scheduled_end_date: "2026-10-06T10:38:27.858997",
    patient_address: "Lagos, Lagos",
    patient_latitude: 6.45,
    patient_longitude: 3.47,
    patient_city: "Lagos",
    patient_state: "Lagos",
    status: "pending",
    payment_status: "paid",
    total_amount: 55000,
    service_fee: 50000,
    platform_fee: 5000,
    special_instructions: null,
    booking_for: "myself",
    created_at: "2026-10-06T08:23:27.859618",
    updated_at: "2026-10-06T08:23:27.875424",
    dispatch_state: "dispatching",
    visit_code: null,
    payment_url: null,
    payment_access_code: null,
    payment_error: null,
  },
};

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(
    <QueryClientProvider client={client}>
      <Notifications />
    </QueryClientProvider>,
  );
}

describe("Notifications screen", () => {
  beforeEach(async () => {
    await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    mockNavigate.mockClear();
    await act(async () => {
      await session.signOut();
    });
  });

  it("shows a spinner while loading", async () => {
    jest.spyOn(notificationService, "list").mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    expect(screen.getByTestId("notifications-loading")).toBeTruthy();
  });

  it("shows the empty state", async () => {
    jest.spyOn(notificationService, "list").mockResolvedValue([]);
    await renderScreen();
    expect(await screen.findByText("No notifications yet")).toBeTruthy();
  });

  it("shows the friendly error with a retry that refetches", async () => {
    const list = jest
      .spyOn(notificationService, "list")
      .mockRejectedValueOnce(new ApiError(0, null, "x"))
      .mockResolvedValue([notification]);
    await renderScreen();
    expect(await screen.findByText(/Can't reach Oakly/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("Nurse visit request")).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("lists notifications and opens an un-accepted one as an offer", async () => {
    jest.spyOn(notificationService, "list").mockResolvedValue([notification]);
    await renderScreen();
    expect(await screen.findByText("Nurse visit request")).toBeTruthy();
    await fireEvent.press(screen.getByText("Nurse visit request"));
    expect(mockNavigate).toHaveBeenCalledWith("BookingDetails", {
      bookingId: notification.booking_id,
      offer: expect.objectContaining({ id: notification.booking_id, area: "Lagos, Lagos", response: null }),
    });
  });

  it("tells offers apart by service, visit time and area, and drops the meaningless ETA (DP1-20)", async () => {
    const other = {
      ...notification,
      id: "n2",
      booking_id: "b2",
      booking: { ...notification.booking, id: "b2", service_type: "physio", scheduled_date: "2026-10-09T14:00:00", patient_city: "Ikeja", duration_hours: 1 },
    };
    jest.spyOn(notificationService, "list").mockResolvedValue([notification, other]);
    await renderScreen();
    expect(await screen.findByText("Nurse visit request")).toBeTruthy();
    expect(screen.getByText("Physio visit request")).toBeTruthy();
    expect(screen.getByText(/1 hour • Ikeja, Lagos/)).toBeTruthy();
    expect(screen.getByText(/2 hours • Lagos, Lagos/)).toBeTruthy();
    expect(screen.queryByText(/ETA/)).toBeNull();
    expect(screen.queryByText("New Booking Request")).toBeNull();
    expect(screen.getAllByText("0.0 km away").length).toBe(2);
  });

  it("opens a declined offer as unavailable: it carries the response so Accept/Decline are hidden", async () => {
    const declined = { ...notification, response: "declined" };
    jest.spyOn(notificationService, "list").mockResolvedValue([declined]);
    await renderScreen();
    expect(await screen.findByText("No longer available")).toBeTruthy();
    await fireEvent.press(screen.getByText("Nurse visit request"));
    expect(mockNavigate).toHaveBeenCalledWith("BookingDetails", {
      bookingId: notification.booking_id,
      offer: expect.objectContaining({ response: "declined" }),
    });
  });

  it("opens a booking assigned to this caregiver by id, with no offer", async () => {
    const assigned = { ...notification, booking: { ...notification.booking, caregiver_id: "cg1", status: "accepted" as const } };
    jest.spyOn(notificationService, "list").mockResolvedValue([assigned]);
    await renderScreen();
    await fireEvent.press(await screen.findByText("Nurse visit request"));
    expect(mockNavigate).toHaveBeenCalledWith("BookingDetails", { bookingId: notification.booking_id });
  });

  it("pull-to-refresh refetches", async () => {
    const list = jest.spyOn(notificationService, "list").mockResolvedValue([notification]);
    await renderScreen();
    await screen.findByText("Nurse visit request");
    await act(async () => {
      screen.getByTestId("notifications-list").props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
