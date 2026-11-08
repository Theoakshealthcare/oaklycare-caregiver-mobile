import { fireEvent, render, screen } from "@testing-library/react-native";

import ChipSelect from "../src/components/ui/chip-select";
import { isPastSlot, timeOptions, toLocalDate } from "../src/domain/slots";

// Clock text is never asserted (the Mac is Lagos, CI is UTC): instants are built from local parts, so they hold anywhere.
const at = (y: number, m: number, d: number, hh: number, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();

describe("isPastSlot", () => {
  const now = at(2026, 11, 8, 14, 30);

  it("is true for an earlier hour today and false for a later one", () => {
    expect(isPastSlot("2026-11-08", "09:00", now)).toBe(true);
    expect(isPastSlot("2026-11-08", "14:00", now)).toBe(true);
    expect(isPastSlot("2026-11-08", "15:00", now)).toBe(false);
  });

  it("is false for every time tomorrow and true for any time yesterday", () => {
    for (const t of timeOptions()) {
      expect(isPastSlot("2026-11-09", t.value, now)).toBe(false);
      expect(isPastSlot("2026-11-07", t.value, now)).toBe(true);
    }
  });

  it("agrees with toLocalDate", () => {
    expect(toLocalDate("2026-11-08", "15:00").getTime()).toBe(at(2026, 11, 8, 15));
  });
});

describe("ChipSelect disabledValues", () => {
  const options = [
    { value: "07:00", label: "7:00 AM" },
    { value: "08:00", label: "8:00 AM" },
  ];

  it("shows a disabled chip, marks it disabled for accessibility and ignores presses on it", async () => {
    const onChange = jest.fn();
    await render(<ChipSelect label="Start time" options={options} value="" onChange={onChange} disabledValues={["07:00"]} />);
    const early = screen.getByRole("button", { name: "7:00 AM" });
    expect(early.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(early);
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "8:00 AM" }));
    expect(onChange).toHaveBeenCalledWith("08:00");
  });
});
