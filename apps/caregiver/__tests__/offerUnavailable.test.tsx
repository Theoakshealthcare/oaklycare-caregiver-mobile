import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import React from "react";

import BookingDetails from "../src/screens/booking/BookingDetails";
import type { Offer } from "../src/services/booking.service";

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
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

async function renderOffer(response?: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
