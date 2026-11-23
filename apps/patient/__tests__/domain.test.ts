import {
  canCancel,
  canTrack,
  isActive,
  needsPayment,
  refundText,
  showsVisitCode,
  statusLabel,
  tabForStatus,
  type BookingStatus,
  type DispatchState,
  type PaymentState,
} from "../src/domain/booking";
import { formatNaira } from "../src/domain/format";
import { formatSlot, isPastDay, monthWeeks, ordinal, timeOptions, toLocalDate } from "../src/domain/slots";
import { durationChoices, durationLabel } from "../src/domain/bookingChoices";
import { isEmail, passwordProblem } from "../src/domain/validation";
import { readingText, validateEntry } from "../src/domain/vitals";
import { digitsOnly } from "../src/components/ui/otp-input";
import { waitText } from "../src/api/errors";

describe("domain helpers", () => {
  it("formats naira with the sign and thousands commas", () => {
    expect(formatNaira(250000)).toBe("₦250,000");
    expect(formatNaira(999)).toBe("₦999");
    expect(formatNaira(1234567.4)).toBe("₦1,234,567");
  });

  it("maps every booking status to one tab, and only shows the visit code before the visit starts", () => {
    const all: BookingStatus[] = ["pending", "accepted", "en_route", "in_progress", "completed", "cancelled", "declined"];
    expect(all.map(tabForStatus)).toEqual(["upcoming", "upcoming", "upcoming", "upcoming", "completed", "canceled", "canceled"]);
    expect(all.filter((status) => showsVisitCode({ status, visitCode: "1234" }))).toEqual(["accepted", "en_route"]);
    expect(showsVisitCode({ status: "accepted", visitCode: null })).toBe(false);
    // Cancel is offered while looking, accepted or on the way; the visit under way is a handover to support.
    expect(all.filter((status) => canCancel({ status }))).toEqual(["pending", "accepted", "en_route"]);
    expect(all.filter((status) => canTrack({ status }))).toEqual(["accepted", "en_route", "in_progress"]);
    expect(all.filter((status) => isActive({ status }))).toEqual(["pending", "accepted", "en_route", "in_progress"]);
  });

  it("words every status and dispatch state, reading status first (dispatch_state is not cleared on a cancelled booking)", () => {
    const label = (status: BookingStatus, dispatchState: DispatchState | null, paymentStatus: PaymentState = "paid") =>
      statusLabel({ status, dispatchState, paymentStatus });
    expect(label("pending", "dispatching")).toBe("Looking for a caregiver");
    expect(label("pending", null)).toBe("Looking for a caregiver");
    expect(label("pending", "unmatched")).toBe("No caregiver found yet");
    expect(label("pending", null, "pending")).toBe("Payment pending");
    expect(label("accepted", "matched")).toBe("Caregiver assigned");
    expect(label("en_route", "matched")).toBe("Caregiver is on the way");
    expect(label("in_progress", "matched")).toBe("Visit in progress");
    expect(label("completed", "matched")).toBe("Completed");
    expect(label("cancelled", "dispatching")).toBe("Canceled");
    expect(label("cancelled", null, "failed")).toBe("Payment failed");
    expect(label("declined", null)).toBe("Declined");
    expect(needsPayment({ status: "pending", paymentStatus: "pending" })).toBe(true);
    expect(needsPayment({ status: "pending", paymentStatus: "paid" })).toBe(false);
    expect(needsPayment({ status: "cancelled", paymentStatus: "pending" })).toBe(false);
  });

  it("words each of the backend's six refund statuses", () => {
    const statuses = ["under_review", "processing", "needs_bank_details", "refunded", "declined", "contact_support"] as const;
    expect(statuses.map((status) => refundText({ status, amount: null }))).toEqual([
      "Your refund is being reviewed.",
      "Your refund has been approved and is on its way.",
      "Our team will contact you for your bank details.",
      "Your refund has been sent.",
      "This refund was not approved. Contact support.",
      "Please contact support about this refund.",
    ]);
  });

  it("checks vital entries against plausible ranges and the blood pressure order", () => {
    expect(validateEntry("heart_rate", { value: "72" })).toEqual({});
    expect(validateEntry("heart_rate", { value: "5" })).toEqual({ value: "Enter a number from 20 to 250" });
    expect(validateEntry("temperature", { value: "36,8" })).toEqual({});
    expect(validateEntry("blood_pressure", { value: "120", secondary: "80" })).toEqual({});
    expect(validateEntry("blood_pressure", { value: "80", secondary: "120" }).secondary).toMatch(/lower than the top/);
    expect(readingText({ value: 120, secondary: 80 })).toBe("120/80");
    expect(readingText({ value: 36.7 })).toBe("36.7");
  });

  it("offers hourly start times, and reads a slot back as a local date", () => {
    expect(timeOptions()[0]).toEqual({ value: "07:00", label: "7:00 AM" });
    expect(timeOptions()[5]).toEqual({ value: "12:00", label: "12:00 PM" });
    expect(toLocalDate("2026-11-07", "14:00").getHours()).toBe(14);
  });

  it("writes a slot the way Figma does: 'March 20th 10:00 am'", () => {
    expect(formatSlot("2026-03-20", "10:00")).toBe("March 20th 10:00 am");
    expect(formatSlot("2026-11-01", "20:00")).toBe("November 1st 8:00 pm");
    expect(formatSlot("2026-11-12", "12:00")).toBe("November 12th 12:00 pm");
    expect(formatSlot("2026-11-23", "")).toBe("November 23rd");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
  });

  it("lays a month out in weeks of seven, Sunday first, and knows which days are over", () => {
    const weeks = monthWeeks(2026, 10); // November 2026 starts on a Sunday and has 30 days
    expect(weeks[0][0]).toBe(1);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((d) => d !== null)).toHaveLength(30);
    expect(monthWeeks(2026, 11)[0].slice(0, 2)).toEqual([null, null]); // December 2026 starts on a Tuesday
    const now = new Date(2026, 10, 23, 15, 0);
    expect(isPastDay(2026, 10, 22, now)).toBe(true);
    expect(isPastDay(2026, 10, 23, now)).toBe(false);
  });

  it("builds the allowed visit lengths from the server's minimum, step and maximum, never from fixed numbers", () => {
    expect(durationChoices({ minMinutes: 60, stepMinutes: 30, maxMinutes: 180 })).toEqual([
      { value: "60", label: "1 hour" },
      { value: "90", label: "1 hour 30 minutes" },
      { value: "120", label: "2 hours" },
      { value: "150", label: "2 hours 30 minutes" },
      { value: "180", label: "3 hours" },
    ]);
    expect(durationChoices({ minMinutes: 30, stepMinutes: 30, maxMinutes: 60 }).map((c) => c.label)).toEqual(["30 minutes", "1 hour"]);
    expect(durationLabel(1440)).toBe("24 hours");
  });

  it("validates email and password the way the forms use them", () => {
    expect(isEmail("ada@example.com")).toBe(true);
    expect(isEmail("ada@example")).toBe(false);
    expect(passwordProblem("")).toBe("Password is required");
    expect(passwordProblem("1234567")).toBe("Password must be at least 8 characters");
    expect(passwordProblem("12345678")).toBeUndefined();
  });

  it("keeps only digits, at most the code length, and words a Retry-After", () => {
    expect(digitsOnly("1a2-3 4567", 5)).toBe("12345");
    expect(waitText(45)).toBe("45 seconds");
    expect(waitText(1)).toBe("1 second");
    expect(waitText(300)).toBe("5 minutes");
  });
});
