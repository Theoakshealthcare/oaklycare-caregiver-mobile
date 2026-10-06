import { render, screen } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";

import App from "../App";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

describe("App", () => {
  afterAll(() => {
    // React Query keeps gc timers per cache entry; clear them so the worker can exit.
    queryClient.clear();
  });

  it("restores the (empty) session and shows the onboarding screen when signed out", async () => {
    const view = await render(<App />);
    expect(await screen.findByText("AI-Powered Personalized Care")).toBeTruthy();
    view.unmount();
  });
});
