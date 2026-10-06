import { render, screen } from "@testing-library/react-native";

import App from "../App";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

describe("App", () => {
  it("restores the (empty) session and shows the onboarding screen when signed out", async () => {
    await render(<App />);
    expect(await screen.findByText("AI-Powered Personalized Care")).toBeTruthy();
  });
});
