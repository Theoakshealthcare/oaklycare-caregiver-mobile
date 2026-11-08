import { bookingErrorMessage, pointsToSupport } from "../src/api/bookingErrors";
import { ApiError, FALLBACK_MESSAGE, NETWORK_MESSAGE } from "../src/api/errors";
import { isNetworkFailure } from "../src/api/networkFailure";
import { unwrap } from "../src/api/unwrap";
import { canChat, feeReason, paymentChip, type Booking, type CancelTerms } from "../src/domain/booking";
import { firstNameOf, specialInstructions, toBooking, toCancelTerms, toCreateBody } from "../src/services/bookingMapper";
import { readPaymentCheck, termsFromChangedError } from "../src/services/booking.service";
import { EMPTY_DRAFT } from "../src/hooks/bookingDraft";
import { capture } from "../test-utils/captures";

const failing = (error: unknown) => unwrap(Promise.reject(error) as never);

describe("one place for 'Can't reach Oakly'", () => {
  it("recognises a request that never completed, whichever fetch reported it", () => {
    expect(isNetworkFailure(new TypeError("Network request failed"))).toBe(true); // React Native fetch
    expect(isNetworkFailure(new TypeError("Network request timed out"))).toBe(true);
    expect(isNetworkFailure(new Error("fetch failed: Could not connect to the server."))).toBe(true); // expo/fetch
    expect(isNetworkFailure(new TypeError("fetch failed"))).toBe(true); // undici
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new TypeError("Load failed"))).toBe(true);
  });

  it("never blames the connection for our own mistakes", () => {
    expect(isNetworkFailure(new TypeError("undefined is not a function"))).toBe(false);
    expect(isNetworkFailure(new TypeError("Cannot read properties of undefined (reading 'full_name')"))).toBe(false);
    expect(isNetworkFailure(new Error("Unsupported FormDataPart implementation"))).toBe(false);
    expect(isNetworkFailure(new Error("fetch failed: The operation was aborted."))).toBe(false);
    expect(isNetworkFailure("Network request failed")).toBe(false);
  });

  it("unwrap turns a network failure into the network message and any other throw into the generic one", async () => {
    await expect(failing(new TypeError("Network request failed"))).rejects.toMatchObject({ status: 0, message: NETWORK_MESSAGE });
    await expect(failing(new TypeError("x is not a function"))).rejects.toMatchObject({ status: -1, message: FALLBACK_MESSAGE });
    await expect(failing(new ApiError(409, null, "kept"))).rejects.toMatchObject({ status: 409, message: "kept" });
  });
});

describe("booking error codes", () => {
  const coded = (status: number, code: string, message = "server words") => new ApiError(status, { detail: { code, message } }, message);

  it("reads detail.code from the object shape and ignores the string and list shapes", () => {
    expect(coded(409, "terms_changed").code).toBe("terms_changed");
    expect(new ApiError(403, { detail: "Access denied. Patient account required." }, "x").code).toBeNull();
    expect(new ApiError(422, { detail: [{ msg: "bad" }] }, "x").code).toBeNull();
  });

  it("gives every code in the guide a plain sentence of ours, and the generic wording for anything else", () => {
    const codes = [
      "terms_changed",
      "booking_in_progress",
      "booking_completed",
      "booking_already_cancelled",
      "booking_closed",
      "payment_under_review",
      "payment_check_unavailable",
      "not_your_booking",
      "booking_not_found",
    ];
    for (const code of codes) {
      const text = bookingErrorMessage(coded(409, code));
      expect(text).not.toBe("server words");
      expect(text).toMatch(/[a-z]/);
    }
    expect(bookingErrorMessage(coded(409, "something_new", "A new sentence"))).toBe("A new sentence");
    expect(bookingErrorMessage(coded(503, "payment_check_unavailable"))).toMatch(/nothing was cancelled/);
    expect(bookingErrorMessage(new ApiError(0, null, NETWORK_MESSAGE))).toBe(NETWORK_MESSAGE);
    expect(pointsToSupport(coded(409, "booking_in_progress"))).toBe(true);
    expect(pointsToSupport(coded(409, "booking_completed"))).toBe(false);
  });

  it("a coded 503 shows its own sentence instead of 'something went wrong on our side'", () => {
    const { body } = capture("059-p-u3-cancel-paystack-unreachable");
    expect(new ApiError(503, body, "").code).toBe("payment_check_unavailable");
  });

  it("reads the new terms out of a 409 terms_changed (capture 032)", () => {
    const { status, body } = capture("032-p-b2-cancel-terms-changed");
    expect(status).toBe(409);
    const terms = termsFromChangedError(new ApiError(409, body, "x"));
    expect(terms).toMatchObject({ feeTier: "standard", feePercent: 20, feeAmount: 10000, feeAmountKobo: 1000000, refundableAmount: 45000 });
    expect(termsFromChangedError(coded(409, "booking_completed"))).toBeNull();
  });
});

describe("mapping the real responses", () => {
  it("maps a captured booking detail (visit code, caregiver first name, UTC time)", () => {
    const b = toBooking(capture("022-p-b2-detail-accepted").body);
    expect(b).toMatchObject({
      reference: "D96F7B66",
      status: "accepted",
      paymentStatus: "paid",
      dispatchState: "matched",
      visitCode: "9893",
      caregiver: { firstName: "Placeholder" },
      cancelFee: null,
      cancelFeeTier: null,
      refund: null,
    });
    expect(b.scheduledAt.endsWith("Z")).toBe(true); // the backend sends UTC without a Z
    expect(b.address).toBe("12 Placeholder Street, Lekki, Lagos, Lagos");
  });

  it("keeps cancel_fee null (not cancelled by the booker) apart from 0 (a free cancel), and carries the refund", () => {
    const after = toBooking(capture("016-p-b1-detail-after-cancel").body);
    expect(after).toMatchObject({ status: "cancelled", cancelFee: 0, cancelFeeTier: "none", refund: { status: "under_review", amount: 55000 }, visitCode: null });
    expect(toBooking(capture("020-p-b1-detail-refund-approved").body).refund).toEqual({ status: "processing", amount: 55000 });
  });

  it("maps cancel terms from a capture, kobo included", () => {
    const t = toCancelTerms(capture("024-p-b2-cancel-terms-standard").body);
    expect(t).toMatchObject({ canCancel: true, feeTier: "standard", feeAmountKobo: 1000000, refundableAmount: 45000, refundWillBeQueued: true });
    expect(t.policy).toEqual({ freeHours: 12, lateHours: 2, feePercent: 20, lateFeePercent: 50 });
    const blocked = toCancelTerms(capture("045-p-b3-cancel-terms-in-progress").body);
    expect(blocked).toMatchObject({ canCancel: false, reason: "booking_in_progress", policy: null });
  });

  it("builds the reason for a fee from the policy numbers in the response, never from constants", () => {
    const base = toCancelTerms(capture("024-p-b2-cancel-terms-standard").body);
    const edited = (changes: Partial<CancelTerms>): CancelTerms => ({ ...base, ...changes });
    expect(feeReason(base)).toMatch(/less than 12 hours.*20%/);
    expect(feeReason(edited({ policy: { ...base.policy!, freeHours: 24 } }))).toMatch(/less than 24 hours/);
    expect(feeReason(edited({ feeTier: "late", feePercent: 50 }))).toMatch(/less than 2 hours.*on the way.*50%/);
    expect(feeReason(edited({ feeTier: "none", feePercent: 0, paidAmount: 0 }))).toMatch(/not paid yet/);
    expect(feeReason(edited({ feeTier: "none", feePercent: 0, caregiverAssigned: false }))).toMatch(/No caregiver is assigned/);
  });

  it("first names skip titles", () => {
    expect(firstNameOf("Dr. John Smith")).toBe("John");
    expect(firstNameOf("Cora Placeholder")).toBe("Cora");
    expect(firstNameOf("Cora")).toBe("Cora");
  });

  it("puts gender and language preference into the special instructions text, nothing when there are none", () => {
    expect(specialInstructions({ instructions: "", genderPreference: "any", languagePreference: "any" })).toBeNull();
    expect(specialInstructions({ instructions: "Gate code 4", genderPreference: "female", languagePreference: "Yoruba" })).toBe(
      "Gate code 4\nPreferred caregiver gender: female\nPreferred language: Yoruba",
    );
  });

  it("builds the create body from the form: nurse only, ISO time, the phone's coordinates", () => {
    const body = toCreateBody({
      ...EMPTY_DRAFT,
      forWhom: " My mother ",
      assistance: "Wound dressing",
      date: "2026-12-01",
      time: "14:00",
      durationHours: "4",
      state: "Lagos",
      city: "Ikeja",
      address: "12 Sample Street",
      latitude: 6.4474,
      longitude: 3.4723,
    });
    expect(body).toMatchObject({
      service_type: "nurse",
      assistance_type: "Wound dressing",
      condition: null,
      duration_hours: 4,
      patient_latitude: 6.4474,
      patient_longitude: 3.4723,
      patient_city: "Ikeja",
      patient_state: "Lagos",
      booking_for: "My mother",
      special_instructions: null,
    });
    expect(new Date(body.scheduled_date).getHours()).toBe(14);
    expect(() => toCreateBody({ ...EMPTY_DRAFT })).toThrow();
  });

  it("reads the verify-payment answer: only 'success' and 'paid' is paid", () => {
    expect(readPaymentCheck({ status: "success", payment_status: "paid", message: "Payment verified successfully" })).toEqual({ kind: "paid" });
    expect(readPaymentCheck({ status: "success", payment_status: "paid", refund_required: true })).toEqual({ kind: "paid_refund_required" });
    expect(readPaymentCheck({ status: "pending", message: "Payment not yet completed", payment_status: "abandoned" })).toEqual({
      kind: "not_paid",
      message: "Payment not yet completed",
    });
    expect(readPaymentCheck({ status: "error", message: "Transaction reference not found" }).kind).toBe("not_paid");
    expect(readPaymentCheck(null).kind).toBe("not_paid");
  });
});

describe("booking payment chip and chat (P1-08)", () => {
  type Money = Pick<Booking, "status" | "paymentStatus" | "refund">;
  const base: Money = { status: "cancelled", paymentStatus: "paid", refund: null };
  const chip = (over: Partial<Money> = {}) => paymentChip({ ...base, ...over }).label;

  it("never says PAID on a cancelled booking: the refund state if there is one, else Canceled", () => {
    expect(chip({ refund: { status: "under_review", amount: 100 } })).toBe("REFUND PENDING");
    expect(chip({ refund: { status: "processing", amount: 100 } })).toBe("REFUND PENDING");
    expect(chip({ refund: { status: "needs_bank_details", amount: null } })).toBe("REFUND PENDING");
    expect(chip({ refund: { status: "contact_support", amount: null } })).toBe("REFUND PENDING");
    expect(chip({ refund: { status: "refunded", amount: 100 } })).toBe("REFUNDED");
    expect(chip({ refund: { status: "declined", amount: null } })).toBe("REFUND DECLINED");
    expect(chip({ paymentStatus: "pending" })).toBe("CANCELED");
    expect(chip()).toBe("CANCELED");
    expect(chip({ paymentStatus: "refunded" })).toBe("REFUNDED");
    expect(chip({ paymentStatus: "failed" })).toBe("PAYMENT FAILED");
  });

  it("keeps the money chips for a booking that is not cancelled", () => {
    expect(chip({ status: "accepted" })).toBe("PAID");
    expect(chip({ status: "pending", paymentStatus: "pending" })).toBe("PAYMENT PENDING");
    expect(chip({ status: "completed", paymentStatus: "partially_refunded" })).toBe("REFUNDED");
    expect(chip({ status: "pending", paymentStatus: "failed" })).toBe("PAYMENT FAILED");
  });

  it("offers the chat only with a caregiver and not once cancelled", () => {
    expect(canChat({ status: "accepted", caregiver: { firstName: "Grace" } })).toBe(true);
    expect(canChat({ status: "completed", caregiver: { firstName: "Grace" } })).toBe(true);
    expect(canChat({ status: "cancelled", caregiver: { firstName: "Grace" } })).toBe(false);
    expect(canChat({ status: "pending", caregiver: null })).toBe(false);
  });
});
