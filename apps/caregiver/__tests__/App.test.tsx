import { act, render, screen } from "@testing-library/react-native";

import App from "../App";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

describe("App", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows the onboarding screen after the splash", async () => {
    await render(<App />);
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(screen.getByText("AI-Powered Personalized Care")).toBeTruthy();
  });
});
