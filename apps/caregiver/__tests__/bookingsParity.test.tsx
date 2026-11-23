import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";

import { sessionLine, startLabel, statusChip } from "../src/booking/bookingCardModel";
import CaregiverBookings from "../src/screens/booking/CaregiverBookings";
import { bookingService, type Booking } from "../src/services/booking.service";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate } }),
}));

// An accepted booking in the full caregiver view (placeholder data), and an offer view of another job (no name, no earning).
const assigned = {
  id: "11111111-1111-4111-8111-111111111111",
  booking_code: "74511A06",
  channel: "app",
  patient_id: "22222222-2222-4222-8222-222222222222",
  patient_details: { patient_id: "x", full_name: "Placeholder Patient", phone_number: null, profile_image_url: null },
  caregiver_id: "c1",
  caregiver_details: null,
  service_type: "nurse",
  assistance_type: "Wound dressing",
  condition: null,
  duration_hours: 1.5,
  duration_minutes: 90,
  scheduled_date: "2026-10-06T08:05:36",
  scheduled_end_date: "2026-10-06T09:35:36",
  patient_address: "12 Placeholder Street",
  patient_latitude: 6.4474,
  patient_longitude: 3.4723,
  patient_city: "Lagos",
  patient_state: "Lagos",
  status: "accepted",
  payment_status: "paid",
  total_amount: 55000,
  service_fee: 50000,
  platform_fee: 5000,
  caregiver_earning: 16000,
  special_instructions: null,
  booking_for: "myself",
  created_at: "2026-10-06T07:50:36",
  updated_at: "2026-10-06T07:50:36",
} as unknown as Booking;

const offerView = {
  ...assigned,
  id: "33333333-3333-4333-8333-333333333333",
  patient_details: null,
  caregiver_id: null,
  patient_address: "Lagos, Lagos",
  caregiver_earning: null,
  status: "pending",
} as unknown as Booking;

function serve(byFilter: Record<string, Booking[]>) {
  jest.spyOn(bookingService, "listCaregiverBookings").mockImplementation(async (filter) => byFilter[filter] ?? []);
}

async function renderBookings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return await render(
    <QueryClientProvider client={client}>
      <CaregiverBookings />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
});

describe("Bookings header and tabs (Figma 8.18.01)", () => {
  it("has a bell that opens Notifications and the three tabs, with the Upcoming typo fixed", async () => {
    serve({});
    await renderBookings();
    await fireEvent.press(await screen.findByLabelText("Notifications"));
    expect(mockNavigate).toHaveBeenCalledWith("Notifications");
    expect(screen.getByText("Bookings")).toBeTruthy();
    expect(screen.getByText("New Request")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.queryByText("New request")).toBeNull();
  });
});

describe("New Request cards", () => {
  it("title the job by its service (no patient name before accepting), with the chip, address, time and the three buttons", async () => {
    serve({ new_requests: [offerView] });
    await renderBookings();
    expect(await screen.findByText("Nurse visit")).toBeTruthy();
    expect(screen.getByText("Wound dressing")).toBeTruthy();
    expect(screen.getByTestId("offer-area")).toHaveTextContent("Lagos, Lagos");
    for (const label of ["View Details", "Decline", "Accept"]) expect(screen.getByText(label)).toBeTruthy();
    // No earning before acceptance, and the family's total is never shown.
    expect(screen.queryByTestId("booking-price")).toBeNull();
    expect(screen.queryByText(/55,000/)).toBeNull();
  });

  it("View Details opens the offer, with the offer narrowed to job facts", async () => {
    serve({ new_requests: [offerView] });
    await renderBookings();
    await fireEvent.press(await screen.findByText("View Details"));
    expect(mockNavigate).toHaveBeenCalledWith("BookingDetails", {
      bookingId: offerView.id,
      offer: expect.objectContaining({ id: offerView.id, area: "Lagos, Lagos" }),
    });
  });
});

describe("Upcoming and Completed cards", () => {
  async function openTab(name: string) {
    await renderBookings();
    await fireEvent.press(await screen.findByText(name));
  }

  it("Upcoming: patient name, Confirmed, service chip, address, time, the caregiver's own price, and the buttons", async () => {
    serve({ accepted: [assigned] });
    await openTab("Upcoming");
    expect(await screen.findByText("Placeholder Patient")).toBeTruthy();
    expect(screen.getByText("Confirmed")).toBeTruthy();
    expect(screen.getByText("Wound dressing")).toBeTruthy();
    expect(screen.getByTestId("booking-address")).toHaveTextContent("12 Placeholder Street, Lagos");
    expect(screen.getByTestId("booking-price")).toHaveTextContent("₦16,000.00 (90 min session)");
    expect(screen.queryByText(/55,000/)).toBeNull();
    for (const label of ["View Details", "Start Service", "Get Direction"]) expect(screen.getByText(label)).toBeTruthy();
  });

  it("Start Service opens the visit steps; View Details opens the booking; Get Direction hands off to the maps app", async () => {
    serve({ accepted: [assigned] });
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await openTab("Upcoming");
    await fireEvent.press(await screen.findByText("Start Service"));
    expect(mockNavigate).toHaveBeenCalledWith("VisitFlow", { bookingId: assigned.id });
    await fireEvent.press(screen.getByText("View Details"));
    expect(mockNavigate).toHaveBeenCalledWith("BookingDetails", { bookingId: assigned.id });
    await fireEvent.press(screen.getByText("Get Direction"));
    expect(open).toHaveBeenCalledWith(expect.stringContaining("6.4474,3.4723"));
  });

  it("Get Direction is not drawn without coordinates, and a visit in progress says Continue Service", async () => {
    serve({ in_progress: [{ ...assigned, status: "in_progress", patient_latitude: null, patient_longitude: null } as Booking] });
    await openTab("Upcoming");
    expect(await screen.findByText("Continue Service")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.queryByText("Get Direction")).toBeNull();
  });

  it("Completed keeps the real completed data: a Completed chip, View Details only", async () => {
    serve({ completed: [{ ...assigned, status: "completed" } as Booking] });
    await openTab("Completed");
    expect(await screen.findByText("Placeholder Patient")).toBeTruthy();
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(2); // the tab and the card's chip
    expect(screen.getByText("View Details")).toBeTruthy();
    expect(screen.queryByText("Start Service")).toBeNull();
    expect(screen.queryByText("Get Direction")).toBeNull();
  });
});

describe("booking card model", () => {
  it("words an accepted visit as Confirmed and falls back to a readable label", () => {
    expect(statusChip("accepted")).toBe("Confirmed");
    expect(statusChip("en_route")).toBe("On the way");
    expect(statusChip("no_show")).toBe("No show");
  });

  it("prices a session only from the caregiver's own earning", () => {
    expect(sessionLine({ caregiver_earning: 16000, duration_minutes: 90 })).toBe("₦16,000.00 (90 min session)");
    expect(sessionLine({ caregiver_earning: null, duration_minutes: 90 })).toBeNull();
    expect(sessionLine({ caregiver_earning: undefined, duration_minutes: 90 })).toBeNull();
  });

  it("offers the visit steps only while the visit is live", () => {
    expect(startLabel("accepted")).toBe("Start Service");
    expect(startLabel("en_route")).toBe("Start Service");
    expect(startLabel("in_progress")).toBe("Continue Service");
    expect(startLabel("completed")).toBeNull();
    expect(startLabel("cancelled")).toBeNull();
  });
});
