import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import BookingDetails from "../src/screens/booking/BookingDetails";
import ClientProfile from "../src/screens/booking/ClientProfile";
import { bookingService, type Booking } from "../src/services/booking.service";
import { carePlansService } from "../src/services/carePlans.service";
import { clientsService, type ClientProfile as Profile } from "../src/services/clients.service";
import { visitPlan } from "../test-utils/carePlanFixtures";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

const BOOKING = "11111111-1111-4111-8111-111111111111";
const NOT_FOUND = new ApiError(404, { detail: "Client not found" }, "Not found");

// Shape of GET /caregiver/bookings/{booking_id}/client (the backend's CaregiverClientProfile). Placeholder data.
const profile = (over: Partial<Profile> = {}): Profile => ({
  booking_id: BOOKING,
  patient_id: "22222222-2222-4222-8222-222222222222",
  full_name: "Placeholder Patient",
  profile_image_url: null,
  booking_for: "myself",
  age: 70,
  gender: "female",
  emergency_contact: { name: "Placeholder Kin", phone: "+2340000000888", relationship: "Daughter" },
  medical_history: {
    blood_group: "O+",
    allergies: "Penicillin",
    medical_conditions: "Type 2 diabetes",
    medications: "Metformin",
    records: [{ record_type: "diagnosis", title: "Hypertension", description: null, severity: "medium", date_recorded: "2019-05-01" }],
  },
  latest_vitals: [
    { vital_type: "heart_rate", value: "84", unit: "bpm", recorded_at: "2026-10-27T10:45:00" },
    { vital_type: "blood_pressure", value: "138/85", unit: "mmHg", recorded_at: "2026-10-27T10:42:00" },
    { vital_type: "mood", value: "ok", unit: null, recorded_at: "2026-10-27T10:40:00" },
  ],
  ...over,
});

async function renderProfile(bookingCode?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = { route: { params: { bookingId: BOOKING, bookingCode } }, navigation: {} };
  return await render(
    <QueryClientProvider client={client}>
      <ClientProfile {...(props as unknown as React.ComponentProps<typeof ClientProfile>)} />
    </QueryClientProvider>,
  );
}

let getSpy: jest.SpyInstance;
beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  getSpy = jest.spyOn(clientsService, "getClientProfile").mockResolvedValue(profile());
  jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan());
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  await session.signOut();
});

describe("ClientProfile", () => {
  it("shows a spinner while it loads", async () => {
    getSpy.mockReturnValue(new Promise(() => undefined));
    await renderProfile();
    expect(screen.getByTestId("client-loading")).toBeTruthy();
  });

  it("shows who the visit is for: name, age and sex, booking code", async () => {
    await renderProfile("OAK123");
    expect(await screen.findByTestId("client-name")).toHaveTextContent("Placeholder Patient");
    expect(screen.getByTestId("client-age-sex")).toHaveTextContent("Age 70. Female");
    expect(screen.getByTestId("client-code")).toHaveTextContent("Booking OAK123");
    expect(getSpy).toHaveBeenCalledWith(BOOKING);
    expect(screen.queryByTestId("client-booked-by")).toBeNull();
  });

  it("shows the Care plan row for the visit under the client card", async () => {
    await renderProfile();
    expect(await screen.findByTestId("care-plan-row")).toBeTruthy();
    expect(carePlansService.getVisitPlan).toHaveBeenCalledWith(BOOKING);
    expect(await screen.findByTestId("care-plan-create")).toBeTruthy();
  });

  it("shows the latest vitals neutrally, only for the vitals the app knows", async () => {
    await renderProfile();
    expect(await screen.findByTestId("client-vital-heart_rate")).toHaveTextContent(/84 bpm/);
    expect(screen.getByTestId("client-vital-blood_pressure")).toHaveTextContent(/138\/85 mmHg/);
    expect(screen.queryByText("ok")).toBeNull();
    expect(screen.queryByText(/critical|normal/i)).toBeNull();
  });

  it("says vitals are available during an active visit when the backend sends null, and when none exist", async () => {
    getSpy.mockResolvedValue(profile({ latest_vitals: null }));
    const first = await renderProfile();
    expect(await screen.findByTestId("client-vitals-unavailable")).toHaveTextContent("Vitals are available during an active visit.");
    await first.unmount();

    getSpy.mockResolvedValue(profile({ latest_vitals: [] }));
    await renderProfile();
    expect(await screen.findByTestId("client-vitals-empty")).toBeTruthy();
  });

  it("opens the Vitals tab from View all, and notes from Add notes", async () => {
    await renderProfile();
    await fireEvent.press(await screen.findByText("View all"));
    expect(mockNavigate).toHaveBeenCalledWith("BottomNavigation", { tab: "vitals", at: expect.any(Number) });
    await fireEvent.press(screen.getByText("Add notes"));
    expect(mockNavigate).toHaveBeenCalledWith("AINoteTaker", { bookingId: BOOKING });
  });

  it("shows medical history that is stored", async () => {
    await renderProfile();
    const history = await screen.findByTestId("client-history");
    for (const text of [/O\+/, /Type 2 diabetes/, /Penicillin/, /Metformin/, /Hypertension · medium severity/]) {
      expect(history).toHaveTextContent(text);
    }
  });

  it("leaves out medical history and emergency contact when none is on file", async () => {
    getSpy.mockResolvedValue(profile({ medical_history: null, emergency_contact: null, age: null, gender: null }));
    await renderProfile();
    expect(await screen.findByTestId("client-nothing-more")).toBeTruthy();
    expect(screen.queryByTestId("client-history")).toBeNull();
    expect(screen.queryByTestId("client-contact")).toBeNull();
    expect(screen.queryByTestId("client-age-sex")).toBeNull();
  });

  it("shows the emergency contact with a call button that dials", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderProfile();
    expect(await screen.findByTestId("client-contact-name")).toHaveTextContent("Placeholder Kin");
    await fireEvent.press(screen.getByTestId("client-contact-call"));
    expect(open).toHaveBeenCalledWith("tel:+2340000000888");
  });

  it("says when the visit was booked by a family member for someone else", async () => {
    getSpy.mockResolvedValue(profile({ booking_for: "mother", full_name: "Mama Recipient", medical_history: null }));
    await renderProfile();
    expect(await screen.findByTestId("client-booked-by")).toBeTruthy();
    expect(screen.getByTestId("client-name")).toHaveTextContent("Mama Recipient");
  });

  it("treats the patient app's capitalised Myself as a visit for the patient themselves", async () => {
    getSpy.mockResolvedValue(profile({ booking_for: "Myself" }));
    await renderProfile();
    await screen.findByTestId("client-name");
    expect(screen.queryByTestId("client-booked-by")).toBeNull();
  });

  it("explains a 404 as 'not available' instead of an error", async () => {
    getSpy.mockRejectedValue(NOT_FOUND);
    await renderProfile();
    expect(await screen.findByText("Client details aren't available")).toBeTruthy();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("offers a retry on other failures", async () => {
    getSpy.mockRejectedValueOnce(new ApiError(500, null, "boom"));
    await renderProfile();
    await fireEvent.press(await screen.findByText("Try again"));
    expect(await screen.findByTestId("client-name")).toBeTruthy();
  });
});

describe("BookingDetails entry point", () => {
  const assigned = {
    id: BOOKING, booking_code: "74511A06", channel: "app", patient_id: "22222222-2222-4222-8222-222222222222",
    patient_details: { patient_id: "x", full_name: "Placeholder Patient", phone_number: null, profile_image_url: null },
    caregiver_id: "c1", caregiver_details: null, service_type: "nurse", assistance_type: "Wound dressing", condition: null,
    duration_hours: 2, scheduled_date: "2026-10-06T08:05:36", scheduled_end_date: "2026-10-06T10:05:36",
    patient_address: "12 Placeholder Street", patient_latitude: null, patient_longitude: null, patient_city: "Lagos",
    patient_state: "Lagos", status: "accepted", payment_status: "paid", total_amount: 1, service_fee: 1, platform_fee: 0,
    special_instructions: null, booking_for: "myself", created_at: "2026-10-06T07:50:36", updated_at: "2026-10-06T07:50:36",
  } as unknown as Booking;

  async function renderDetails(booking: Booking) {
    jest.spyOn(bookingService, "getBooking").mockResolvedValue(booking);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
    const props = { route: { params: { bookingId: booking.id } }, navigation };
    await render(
      <QueryClientProvider client={client}>
        <BookingDetails {...(props as unknown as React.ComponentProps<typeof BookingDetails>)} />
      </QueryClientProvider>,
    );
    return navigation;
  }

  it("offers the client profile for a live visit", async () => {
    const navigation = await renderDetails(assigned);
    await fireEvent.press(await screen.findByText("Client profile"));
    expect(navigation.navigate).toHaveBeenCalledWith("ClientProfile", { bookingId: BOOKING, bookingCode: "74511A06" });
  });

  it("does not offer it once the visit is finished", async () => {
    await renderDetails({ ...assigned, status: "completed" });
    await waitFor(() => expect(screen.getByText("Visit notes")).toBeTruthy());
    expect(screen.queryByText("Client profile")).toBeNull();
  });
});
