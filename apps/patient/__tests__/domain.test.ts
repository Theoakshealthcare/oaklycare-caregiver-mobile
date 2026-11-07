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
import { dateOptions, timeOptions, toLocalDate } from "../src/domain/slots";
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
    expect(all.filter((status) => isActive({ status }))).toEqual(["pending", "accepted", "en_route"]);
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

  it("offers 14 days from today and hourly slots, and reads a slot back as a local date", () => {
    const days = dateOptions(14, new Date(2026, 10, 7));
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ value: "2026-11-07", label: "Sat 7 Nov" });
    expect(days[13].value).toBe("2026-11-20");
    expect(timeOptions()[0]).toEqual({ value: "07:00", label: "7:00 AM" });
    expect(timeOptions()[5]).toEqual({ value: "12:00", label: "12:00 PM" });
    expect(toLocalDate("2026-11-07", "14:00").getHours()).toBe(14);
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
