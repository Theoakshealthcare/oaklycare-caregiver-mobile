import { fireEvent, screen } from "@testing-library/react-native";
import React from "react";

import { CALLING_ENABLED } from "../src/config/calling";
import ChatScreen from "../src/screens/chat/ChatScreen";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("../src/hooks/queries", () => ({
  useMe: () => ({ data: { id: "u1" } }),
  useChatMessages: () => ({ data: [] }),
  useBooking: () => ({ data: undefined }),
  useSendChatMessage: () => ({ mutate: jest.fn() }),
}));
// The constant read live, so one file can show both settings.
let mockCallingEnabled = false;
jest.mock("../src/config/calling", () => ({
  get CALLING_ENABLED() {
    return mockCallingEnabled;
  },
}));

const props = () => routeProps<React.ComponentProps<typeof ChatScreen>>({ bookingId: "b1", patientName: "Placeholder Patient" });

afterEach(() => {
  mockCallingEnabled = false;
  mockNavigate.mockClear();
});

describe("chat header calling buttons", () => {
  it("shows no phone or video button while calling is off (the Call screen is a mock)", async () => {
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByText("Placeholder Patient")).toBeTruthy();
    expect(screen.queryByTestId("chat-call")).toBeNull();
    expect(screen.queryByTestId("chat-video-call")).toBeNull();
  });

  it("shows both and opens the Call screen when the constant is switched on", async () => {
    mockCallingEnabled = true;
    await renderWithClient(<ChatScreen {...props()} />);
    await fireEvent.press(screen.getByTestId("chat-call"));
    expect(mockNavigate).toHaveBeenCalledWith("CallScreen", { bookingId: "b1", patientName: "Placeholder Patient" });
    await fireEvent.press(screen.getByTestId("chat-video-call"));
    expect(mockNavigate).toHaveBeenCalledWith("CallScreen", { bookingId: "b1", patientName: "Placeholder Patient", isVideo: true });
  });

  it("ships with calling off", () => {
    // The real module, not the mock above.
    expect(jest.requireActual("../src/config/calling").CALLING_ENABLED).toBe(false);
    expect(typeof CALLING_ENABLED).toBe("boolean");
  });
});
