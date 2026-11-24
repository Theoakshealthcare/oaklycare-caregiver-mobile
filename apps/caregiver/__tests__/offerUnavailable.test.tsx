import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { DECLINE_FINAL_NOTICE, DECLINE_MESSAGE, DECLINE_TITLE } from "../src/constants/offerCopy";
import BookingDetails from "../src/screens/booking/BookingDetails";
import type { Offer } from "../src/services/booking.service";

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

const offer: Offer = {
  id: "b1",
  serviceType: "nurse",
  assistanceType: null,
  durationHours: 2,
  scheduledDate: "2026-10-06T08:38:27",
  scheduledEndDate: "2026-10-06T10:38:27",
  area: "Lagos, Lagos",
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));

async function renderOffer(response?: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const props = {
    route: { params: { bookingId: "b1", offer: { ...offer, ...(response !== undefined ? { response } : {}) } } },
    navigation: { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() },
  };
  return await render(
    <QueryClientProvider client={client}>
      <BookingDetails {...(props as unknown as React.ComponentProps<typeof BookingDetails>)} />
    </QueryClientProvider>,
  );
}

describe("a job request (DP1-06 follow-up)", () => {
  it("offers Accept and Decline while the offer is unanswered", async () => {
    await renderOffer(null);
    expect(screen.getByText("Accept Job")).toBeTruthy();
    expect(screen.getByText("Decline Job")).toBeTruthy();
    expect(screen.queryByTestId("offer-unavailable")).toBeNull();
  });

  it("warns before the tap that a decline is final, in the shared decline dialog", async () => {
    await renderOffer(null);
    await fireEvent.press(screen.getByText("Decline Job"));
    expect(await screen.findByText(DECLINE_TITLE)).toBeTruthy();
    expect(screen.getByText(DECLINE_MESSAGE)).toBeTruthy();
    expect(screen.getByText(DECLINE_FINAL_NOTICE)).toBeTruthy();
    expect(screen.getByText("No, Go Back")).toBeTruthy();
    expect(screen.getByText("Yes, Decline")).toBeTruthy();
  });

  it("is headed Job Details with the Figma cards: Service Type, Date & Time, Duration, a City row, and no price or patient rows", async () => {
    await renderOffer(null);
    expect(screen.getByText("Job Details")).toBeTruthy();
    for (const label of ["Service Information", "Service Type", "Date & Time", "Duration", "Location", "City"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // The offer carries no earning, no client and no street address; nothing is drawn for them.
    for (const label of ["Payment", "Payment Status", "Client", "Address", "Distance", "Special Instructions", "Get Direction"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("an offer from Home (no response field) still offers Accept and Decline", async () => {
    await renderOffer();
    expect(screen.getByText("Accept Job")).toBeTruthy();
  });

  it("a declined offer says No longer available and has no Accept or Decline", async () => {
    await renderOffer("declined");
    expect(screen.getByText("No longer available")).toBeTruthy();
    expect(screen.queryByText("Accept Job")).toBeNull();
    expect(screen.queryByText("Decline Job")).toBeNull();
  });

  it("an offer someone else took (auto_declined) is also unavailable", async () => {
    await renderOffer("auto_declined");
    expect(screen.getByText("No longer available")).toBeTruthy();
    expect(screen.queryByText("Accept Job")).toBeNull();
  });
});
