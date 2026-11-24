import { render, screen } from "@testing-library/react-native";
import React from "react";

import VitalStatusBadge, { statusTint } from "../src/components/vitals/VitalStatusBadge";
import { theme } from "../src/constants/theme";

// The flag, read live so one file shows both settings.
let mockOn = false;
jest.mock("../src/config/vitals", () => ({
  get VITAL_STATUS_BADGES() {
    return mockOn;
  },
}));

afterEach(() => {
  mockOn = false;
});

describe("VitalStatusBadge", () => {
  it("ships off", () => {
    expect(jest.requireActual("../src/config/vitals").VITAL_STATUS_BADGES).toBe(false);
  });

  it("draws nothing while the flag is off, and the tile stays neutral", async () => {
    await render(<VitalStatusBadge status="critical" />);
    expect(screen.queryByTestId("vital-status")).toBeNull();
    expect(screen.queryByText("Critical")).toBeNull();
    expect(statusTint("critical")).toBe(theme.colors.soft);
  });

  it("forced on: shows the dot and the word, with the tinted tile", async () => {
    mockOn = true;
    await render(<VitalStatusBadge status="normal" />);
    expect(screen.getByText("Normal")).toBeTruthy();
    expect(screen.getByTestId("vital-status-dot")).toHaveStyle({ backgroundColor: theme.colors.success });
    expect(statusTint("normal")).toBe(theme.colors.successLight);
  });

  it("forced on: Critical is red and tinted", async () => {
    mockOn = true;
    await render(<VitalStatusBadge status="critical" />);
    expect(screen.getByText("Critical")).toBeTruthy();
    expect(screen.getByTestId("vital-status-dot")).toHaveStyle({ backgroundColor: theme.colors.error });
    expect(statusTint("critical")).toBe(theme.colors.secondaryLight);
  });

  it("forced on, but with no status to show: still nothing (a reading is never rated here)", async () => {
    mockOn = true;
    await render(<VitalStatusBadge status={null} />);
    expect(screen.queryByTestId("vital-status")).toBeNull();
    expect(statusTint(null)).toBe(theme.colors.soft);
  });
});
