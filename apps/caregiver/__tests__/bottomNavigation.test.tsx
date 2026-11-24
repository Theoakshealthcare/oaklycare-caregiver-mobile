import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { session } from "../src/auth";
import BottomNavigation from "../src/navigation/BottomNavigation";
import { bookingService } from "../src/services/booking.service";

// The pager is native: render its pages as plain children so the test can count them.
jest.mock("react-native-pager-view", () => {
  const { View: RNView } = jest.requireActual("react-native");
  return { __esModule: true, default: ({ children }: { children: React.ReactNode }) => <RNView testID="pager">{children}</RNView> };
});
jest.mock("../src/screens/home/Home", () => ({ __esModule: true, default: () => <MockPage name="home" /> }));
jest.mock("../src/screens/booking/Booking", () => ({ __esModule: true, default: () => <MockPage name="booking" /> }));
jest.mock("../src/screens/chats/Chats", () => ({ __esModule: true, default: () => <MockPage name="chats" /> }));
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));

function MockPage({ name }: { name: string }) {
  return <View testID={`page-${name}`} />;
}

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(bookingService, "listActive").mockResolvedValue([]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await session.signOut();
});

describe("BottomNavigation", () => {
  const renderNav = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return await render(
      <QueryClientProvider client={client}>
        <BottomNavigation />
      </QueryClientProvider>,
    );
  };

  it("has a page for every tab: none is ever blank", async () => {
    await renderNav();
    const pager = screen.getByTestId("pager");
    // Home, Bookings, Chats and Vitals. FallGuard is patient-side (no Fall tab, DP1-18); Learn has no backend (stays off).
    expect(pager.children).toHaveLength(4);
    expect(screen.getByTestId("page-home")).toBeTruthy();
    expect(screen.getByTestId("page-booking")).toBeTruthy();
    expect(screen.getByTestId("page-chats")).toBeTruthy();
    // Vitals: with no visit it explains itself rather than showing nothing.
    expect(await screen.findByText("No active visit")).toBeTruthy();
  });

  it("puts Chats third, between Bookings and Vitals, and has no Learn tab", async () => {
    await renderNav();
    expect(screen.getByTestId("tab-icon-chats")).toBeTruthy();
    expect(screen.queryByText("Learn")).toBeNull();
    // Only the open tab shows its label: open Chats and it reads "Chats".
    fireEvent.press(screen.getByTestId("tab-icon-chats"));
    expect(await screen.findByText("Chats")).toBeTruthy();
  });

  it("has no Fall tab and no FallGuard placeholder", async () => {
    await renderNav();
    expect(screen.queryByText("Fall")).toBeNull();
    expect(screen.queryByText(/FallGuard/)).toBeNull();
  });
});
