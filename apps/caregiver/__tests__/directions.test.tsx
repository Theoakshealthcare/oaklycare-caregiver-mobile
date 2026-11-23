import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Linking, Platform } from "react-native";

import BookingDetails from "../src/screens/booking/BookingDetails";
import { bookingService, type Booking } from "../src/services/booking.service";

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

// An assigned (full view) booking, shaped after the guide's caregiver detail capture.
const assigned: Booking = {
  id: "11111111-1111-4111-8111-111111111111",
  booking_code: "74511A06",
  channel: "whatsapp",
  patient_id: "22222222-2222-4222-8222-222222222222",
  patient_details: {
    patient_id: "22222222-2222-4222-8222-222222222222",
    full_name: "Placeholder Patient",
    phone_number: "+2340000000000",
    profile_image_url: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
  },
  caregiver_id: "33333333-3333-4333-8333-333333333333",
  caregiver_details: null,
  service_type: "nurse",
  assistance_type: "Wound dressing",
  condition: null,
  duration_hours: 2,
  duration_minutes: 120,
  scheduled_date: "2026-10-06T08:05:36.281977",
  scheduled_end_date: "2026-10-06T10:05:36.281977",
  patient_address: "12 Placeholder Street, Lekki",
  patient_latitude: 6.4474,
  patient_longitude: 3.4723,
  patient_city: "Lagos",
  patient_state: "Lagos",
  status: "accepted",
  payment_status: "paid",
  total_amount: 55000,
  service_fee: 50000,
  platform_fee: 5000,
  special_instructions: null,
  booking_for: "myself",
  created_at: "2026-10-06T07:50:36.282705",
  updated_at: "2026-10-06T07:50:36.298243",
  dispatch_state: "matched",
  visit_code: null,
  payment_url: null,
  payment_access_code: null,
  payment_error: null,
};

async function renderDetails(booking: Booking) {
  jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = { route: { params: { bookingId: booking.id } }, navigation: { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() } };
  return await render(
    <QueryClientProvider client={client}>
      <BookingDetails {...(props as unknown as React.ComponentProps<typeof BookingDetails>)} />
    </QueryClientProvider>,
  );
}

describe("Get directions", () => {
  let open: jest.SpyInstance;
  beforeEach(() => {
    open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it("opens the maps app with the booking's coordinates", async () => {
    await renderDetails(assigned);
    await fireEvent.press(await screen.findByText("Get Directions"));
    const expected =
      Platform.OS === "ios"
        ? "http://maps.apple.com/?daddr=6.4474,3.4723&dirflg=d"
        : "https://www.google.com/maps/dir/?api=1&destination=6.4474,3.4723";
    expect(open).toHaveBeenCalledWith(expected);
  });

  it("is hidden once the visit is completed", async () => {
    await renderDetails({ ...assigned, status: "completed" });
    await screen.findByText("Service Information");
    expect(screen.queryByText("Get Directions")).toBeNull();
  });
});

describe("Job Details wording (DP1-15)", () => {
  it("shows the service name and a readable status, and no service fee that reads as the caregiver's pay", async () => {
    await renderDetails(assigned);
    expect(await screen.findByText("Nurse visit")).toBeTruthy();
    expect(screen.getByText("Wound dressing")).toBeTruthy();
    expect(screen.getByText("Accepted")).toBeTruthy();
    expect(screen.queryByText("accepted")).toBeNull();
    expect(screen.queryByText("Service fee")).toBeNull();
    expect(screen.queryByText(/50,000/)).toBeNull();
  });
});
