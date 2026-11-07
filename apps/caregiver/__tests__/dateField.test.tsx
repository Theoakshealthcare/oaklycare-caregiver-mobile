import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";

import DateField from "../src/components/ui/date-field";
import { formatClock, formatDate, formatDayHeading, formatStamp, toDateOnly } from "../src/utils/dates";

// The native picker is not available under jest: a stand-in that exposes the new-API callbacks.
let mockPickerProps: Record<string, unknown> = {};
jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockPickerProps = props;
      return <View testID="native-picker" />;
    },
  };
});

describe("DateField", () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it("shows the shared date format and hands back YYYY-MM-DD from the picker (iOS: after Done)", async () => {
    Platform.OS = "ios";
    const onChange = jest.fn();
    await render(<DateField testID="dob" label="Date of birth" value="1990-05-01" onChange={onChange} />);
    expect(screen.getByText("1 May 1990")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("dob"));
    expect(mockPickerProps.display).toBe("spinner");
    // The deprecated onChange is not used (RC1-03).
    expect(mockPickerProps.onChange).toBeUndefined();
    const onValueChange = mockPickerProps.onValueChange as (e: unknown, d: Date) => void;
    await React.act(async () => onValueChange({}, new Date(1985, 11, 24)));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("dob-done"));
    expect(onChange).toHaveBeenCalledWith("1985-12-24");
  });

  it("shows the placeholder while empty", async () => {
    await render(<DateField testID="dob" label="Date of birth" value="" placeholder="Enter your DOB" onChange={jest.fn()} />);
    expect(screen.getByText("Enter your DOB")).toBeTruthy();
  });
});

describe("shared date and time formatter (DP1-28)", () => {
  it("formats a date-only value as that calendar day, in day-month-year order", () => {
    expect(formatDate("2007-11-07")).toBe("7 Nov 2007");
    expect(formatDate("")).toBe("");
    expect(toDateOnly(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("always uses 24-hour clock text, never am/pm", () => {
    const afternoon = new Date(2026, 10, 6, 14, 28);
    expect(formatClock(afternoon)).toBe("14:28");
    expect(formatStamp(afternoon)).toBe("6 Nov, 14:28");
    expect(formatClock(afternoon)).not.toMatch(/am|pm/i);
    expect(formatDayHeading(afternoon)).toMatch(/6 Nov 2026/);
  });

  it("reads backend timestamps (no Z) as UTC like every other formatter", () => {
    expect(formatClock("2026-11-07T10:56:00")).toBe(formatClock("2026-11-07T10:56:00Z"));
    expect(formatClock(null)).toBe("");
  });
});
