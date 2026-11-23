import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import OnboardingScreen from "../src/screens/onboarding-screen";
import VisitFlow from "../src/screens/visit/VisitFlow";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate } }),
}));

jest.mock("../src/components/StatusBar/FocusedStatusBar", () => ({ __esModule: true, default: () => null }));

jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

jest.mock("../src/hooks/queries", () => ({
  useBooking: () => ({
    data: { status: "completed", patientName: "Placeholder Patient", address: "1 Test St", scheduledDate: "2026-01-01T10:00:00Z" },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useBookingAction: () => ({ isPending: false, mutate: jest.fn() }),
}));

describe("onboarding", () => {
  it("shows the Login link on the first slide and navigates to Login", async () => {
    await render(<OnboardingScreen />);
    expect(screen.getAllByText(/Already have an account \?/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getAllByText("Login")[0]);
    expect(mockNavigate).toHaveBeenCalledWith("Login");
  });
});

describe("welcome slides follow the Figma frames (owner, 2026-11-23: exact parity, four slides)", () => {
  it("are the four Figma slides, FallGuard included", async () => {
    await render(<OnboardingScreen />);
    expect(screen.getByText("AI-Powered Personalized")).toBeTruthy();
    expect(screen.getByText("Remote Monitoring &")).toBeTruthy();
    // Slide 3 is broken into the three lines the Figma frame has: the same words, "Predictor– Predict." sharing a line.
    expect(screen.getByText("Oakly FallGuard™ Fall")).toBeTruthy();
    expect(screen.getByText("Predictor– Predict.")).toBeTruthy();
    expect(screen.getByText("Prevent. Protect.")).toBeTruthy();
    expect(screen.getByText("Book a Nurse Instantly.")).toBeTruthy();
    expect(screen.getByText(/Stay ahead of falls with real-time monitoring/)).toBeTruthy();
    expect(screen.queryByText("Care work that")).toBeNull();
  });
});

describe("visit completed", () => {
  it("Close on the clocked-out page goes to the Home tab", async () => {
    const popTo = jest.fn();
    const client = new QueryClient();
    await render(
      <QueryClientProvider client={client}>
        <VisitFlow
          {...(({ route: { params: { bookingId: "b1" } }, navigation: { popTo, navigate: jest.fn(), goBack: jest.fn() } }) as unknown as React.ComponentProps<typeof VisitFlow>)}
        />
      </QueryClientProvider>,
    );
    fireEvent.press(screen.getByLabelText("Close"));
    expect(popTo).toHaveBeenCalledWith("BottomNavigation", expect.objectContaining({ tab: "home" }));
    client.clear();
  });
});
