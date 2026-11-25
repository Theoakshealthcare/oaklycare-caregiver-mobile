import { render, screen } from "@testing-library/react-native";
import React from "react";

import VitalStatusBadge, { statusTint } from "../src/components/vitals/VitalStatusBadge";
import { theme } from "../src/constants/theme";
import { toFlag, type VitalFlag } from "../src/vitals/vitalFlag";

const flag = (over: Partial<VitalFlag>): VitalFlag => ({ status: "normal", label: "Normal", reason: null, emergency: false, message: null, ...over });
const CRITICAL = flag({ status: "critical", label: "Critical", reason: "Heart rate below 50 bpm.", emergency: true, message: "This may be an emergency. Call 112 now." });

describe("VitalStatusBadge", () => {
  it("Normal: the dot and the word, with the green tile", async () => {
    await render(<VitalStatusBadge flag={flag({})} />);
    expect(screen.getByText("Normal")).toBeTruthy();
    expect(screen.getByTestId("vital-status-dot")).toHaveStyle({ backgroundColor: theme.colors.success });
    expect(screen.queryByTestId("vital-status-emergency")).toBeNull();
    expect(statusTint(flag({}))).toBe(theme.colors.successLight);
  });

  it("High and Low are told apart by word and colour", async () => {
    const { unmount } = await render(<VitalStatusBadge flag={flag({ status: "high", label: "High", reason: "x" })} />);
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByTestId("vital-status-dot")).toHaveStyle({ backgroundColor: theme.colors.warning });
    await unmount();
    await render(<VitalStatusBadge flag={flag({ status: "low", label: "Low", reason: "x" })} />);
    expect(screen.getByText("Low")).toBeTruthy();
    expect(screen.getByTestId("vital-status-dot")).toHaveStyle({ backgroundColor: theme.colors.info });
  });

  it("Critical is red, tinted, and shows the emergency message the server sent", async () => {
    await render(<VitalStatusBadge flag={CRITICAL} />);
    expect(screen.getByText("Critical")).toBeTruthy();
    expect(screen.getByTestId("vital-status-dot")).toHaveStyle({ backgroundColor: theme.colors.error });
    expect(screen.getByTestId("vital-status-emergency")).toHaveTextContent(/Call 112 now/);
    expect(statusTint(CRITICAL)).toBe(theme.colors.errorLight);
  });

  it("draws nothing for a reading with no flag, and the tile stays neutral", async () => {
    await render(<VitalStatusBadge flag={null} />);
    expect(screen.queryByTestId("vital-status")).toBeNull();
    expect(statusTint(null)).toBe(theme.colors.soft);
  });
});

describe("toFlag", () => {
  it("passes the server's flag through unchanged", () => {
    expect(toFlag({ status: "high", label: "High", reason: "Heart rate above 100 bpm.", emergency: false, message: null })).toEqual({
      status: "high", label: "High", reason: "Heart rate above 100 bpm.", emergency: false, message: null,
    });
  });

  it("gives null for no flag, and for a status this build does not know (never a guess)", () => {
    expect(toFlag(null)).toBeNull();
    expect(toFlag(undefined)).toBeNull();
    expect(toFlag({ status: "urgent", label: "Urgent", emergency: false })).toBeNull();
  });
});
