import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import React from "react";

import OfferCard from "../src/components/booking/OfferCard";
import CaregiverBookings from "../src/screens/booking/CaregiverBookings";
import { bookingService, toOffer, type Booking } from "../src/services/booking.service";
import { buildDocumentForm } from "../src/services/caregiver.service";
import { formatDuration, parseBackendDate } from "../src/utils/dates";

jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn() } }),
}));

// An offer view as the backend sends it (guide, capture 075): patient fields are null, the address
// is "<city>, <state>". The decoys below prove the app does not depend on that: even if the server
// leaked patient fields into an offer, none of them would be rendered.
const offerView: Booking = {
  id: "11111111-1111-4111-8111-111111111111",
  booking_code: "74511A06",
  channel: "whatsapp",
  patient_id: "22222222-2222-4222-8222-222222222222",
  patient_details: {
    patient_id: "22222222-2222-4222-8222-222222222222",
    full_name: "Decoy Patient Name",
    phone_number: "+2340000999999",
    profile_image_url: null,
    emergency_contact_name: "Decoy Contact",
    emergency_contact_phone: null,
  },
  caregiver_id: null,
  caregiver_details: null,
  service_type: "nurse",
  assistance_type: "Wound dressing",
  condition: "Decoy condition: diabetic ulcer",
  duration_hours: 2,
  scheduled_date: "2026-10-06T08:05:36.281977",
  scheduled_end_date: "2026-10-06T10:05:36.281977",
  patient_address: "12 Decoy Street, Lekki",
  patient_latitude: 6.4474,
  patient_longitude: 3.4723,
  patient_city: "Lagos",
  patient_state: "Lagos",
  status: "pending",
  payment_status: "paid",
  total_amount: 55000,
  service_fee: 50000,
  platform_fee: 5000,
  special_instructions: "Decoy instructions: gate code 1234",
  booking_for: "myself",
  created_at: "2026-10-06T07:50:36.282705",
  updated_at: "2026-10-06T07:50:36.298243",
  dispatch_state: "dispatching",
  visit_code: null,
  payment_url: null,
  payment_access_code: null,
  payment_error: null,
};

const DECOYS = [
  "Decoy Patient Name",
  "Decoy Contact",
  "Decoy condition",
  "diabetic",
  "Decoy instructions",
  "gate code",
  "12 Decoy Street",
  "Lekki",
  "+2340000999999",
  "6.4474",
];

/** Every string the user could read on screen. Walks `children` only (props hold circular refs). */
function renderedText(): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object" && "children" in node) walk((node as { children: unknown }).children);
  };
  walk(screen.toJSON());
  return out.join(" | ");
}

function expectNoPatientData(text: string) {
  for (const decoy of DECOYS) expect(text).not.toContain(decoy);
}

describe("offer view", () => {
  it("toOffer keeps only job facts and the area", () => {
    const offer = toOffer(offerView);
    expect(offer).toEqual({
      id: offerView.id,
      serviceType: "nurse",
      assistanceType: "Wound dressing",
      durationHours: 2,
      scheduledDate: offerView.scheduled_date,
      scheduledEndDate: offerView.scheduled_end_date,
      area: "Lagos, Lagos",
    });
    expectNoPatientData(JSON.stringify(offer));
  });

  it("OfferCard never renders patient identity, condition, instructions or exact address", async () => {
    await render(<OfferCard offer={toOffer(offerView)} onView={jest.fn()} onAccept={jest.fn()} onDecline={jest.fn()} />);
    expect(screen.getByText("Wound dressing")).toBeTruthy();
    expect(screen.getByText(/Lagos, Lagos/)).toBeTruthy();
    expectNoPatientData(renderedText());
  });

  it("the New Request tab renders offers from a booking list without patient data", async () => {
    jest.spyOn(bookingService, "listCaregiverBookings").mockResolvedValue([offerView]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <CaregiverBookings />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Wound dressing")).toBeTruthy();
    expect(bookingService.listCaregiverBookings).toHaveBeenCalledWith("new_requests");
    expectNoPatientData(renderedText());
  });
});

describe("helpers", () => {
  it("reads backend timestamps (UTC, no Z) as UTC", () => {
    expect(parseBackendDate("2026-10-06T08:05:36.281977").toISOString()).toBe("2026-10-06T08:05:36.281Z");
    expect(parseBackendDate("2026-10-06T08:05:36Z").toISOString()).toBe("2026-10-06T08:05:36.000Z");
    expect(formatDuration(1)).toBe("1 hour");
    expect(formatDuration(2)).toBe("2 hours");
  });

  it("builds a React Native multipart part for the licence", () => {
    const append = jest.spyOn(FormData.prototype, "append");
    const form = buildDocumentForm({ uri: "file:///cache/license.png", name: "license.png", mimeType: "image/png" }, "license");
    expect(form).toBeInstanceOf(FormData);
    expect(append).toHaveBeenCalledWith("document_type", "license");
    // React Native reads a { uri, name, type } descriptor as the file part. It must be the object
    // itself: JSON-stringifying it (the old bug) sends text, not a file.
    expect(append).toHaveBeenCalledWith("file", { uri: "file:///cache/license.png", name: "license.png", type: "image/png" });
    append.mockRestore();
  });
});
