import { describe, expect, it } from "vitest";

import { formatNairaValue } from "./format";
import {
  differentAmountFromError,
  errorCodeOf,
  friendlyRefundError,
  isInFlight,
  isTerminal,
  nairaInput,
  parseNaira,
  refundErrorMessage,
  shownAmount,
} from "./refunds";

describe("parseNaira", () => {
  it("accepts positive amounts with at most two decimals", () => {
    expect(parseNaira("5000")).toBe(5000);
    expect(parseNaira(" 50,000.00 ")).toBe(50000);
    expect(parseNaira("14545.45")).toBe(14545.45);
    expect(parseNaira("0.01")).toBe(0.01);
  });

  it("refuses zero, negatives, three decimals and text", () => {
    for (const bad of ["", "0", "0.00", "-1", "12.345", "1e3", "abc", "12.", ".5"]) expect(parseNaira(bad)).toBeNull();
  });
});

describe("refund display helpers", () => {
  it("formats naira numbers, not kobo", () => {
    expect(formatNairaValue(55000)).toBe("₦55,000");
    expect(formatNairaValue(14545.45)).toBe("₦14,545.45");
    expect(formatNairaValue(0.01)).toBe("₦0.01");
    expect(formatNairaValue(null)).toBe("—");
  });

  it("shows the approved amount, else the suggestion", () => {
    expect(shownAmount({ amount_naira: 20000, suggested_amount_naira: 55000 })).toBe(20000);
    expect(shownAmount({ amount_naira: null, suggested_amount_naira: 55000 })).toBe(55000);
    expect(shownAmount({ amount_naira: null, suggested_amount_naira: null })).toBeNull();
    expect(nairaInput(20000)).toBe("20000");
    expect(nairaInput(null)).toBe("");
  });

  it("knows which states are finished and which are waiting on the send job or Paystack", () => {
    expect(["succeeded", "rejected", "closed"].every((s) => isTerminal(s as never))).toBe(true);
    expect(["pending_approval", "approved", "processing", "needs_attention", "needs_review", "failed"].some((s) => isTerminal(s as never))).toBe(false);
    expect(isInFlight("approved")).toBe(true);
    expect(isInFlight("processing")).toBe(true);
    expect(isInFlight("failed")).toBe(false);
  });
});

describe("server messages", () => {
  it("rewords only the one message that quotes kobo", () => {
    expect(friendlyRefundError("The amount must be between 1 and 5500000 kobo, what is left to refund")).toBe(
      "The amount must be between ₦0.01 and ₦55,000, what is left to refund",
    );
    const untouched = "Refunds on this booking would total ₦55,000, above the ₦50,000 limit for Finance. A Super Admin must approve it.";
    expect(friendlyRefundError(untouched)).toBe(untouched);
  });

  it("reads the amount Paystack confirmed out of the resolve 409", () => {
    const message =
      "Paystack processed a different amount from this refund's. To record what Paystack confirmed, resolve again with that amount (5400000 kobo).";
    expect(differentAmountFromError(message)).toEqual({ naira: 54000 });
    expect(differentAmountFromError("Paystack processed a different amount from this refund's.")).toEqual({ naira: null });
    expect(differentAmountFromError("This refund is not waiting for review")).toBeNull();
  });
});

describe("detail.code errors", () => {
  it("reads the code out of an object detail, and only out of that", () => {
    expect(errorCodeOf({ detail: { code: "wallet_refunds_disabled", message: "m" } })).toBe("wallet_refunds_disabled");
    expect(errorCodeOf({ detail: "A string detail" })).toBeNull();
    expect(errorCodeOf({ detail: [{ msg: "bad" }] })).toBeNull();
    expect(errorCodeOf({ detail: { message: "no code" } })).toBeNull();
    expect(errorCodeOf({ detail: { code: 409 } })).toBeNull();
    expect(errorCodeOf(null)).toBeNull();
    expect(errorCodeOf(undefined)).toBeNull();
    expect(errorCodeOf("text")).toBeNull();
  });

  it("words wallet_refunds_disabled as ours, and leaves other errors as the server sent them", () => {
    const wallet = refundErrorMessage("server wording", { detail: { code: "wallet_refunds_disabled", message: "server wording" } });
    expect(wallet).toMatch(/switched off/);
    expect(wallet).toMatch(/original payment method/);
    // an unknown code, a string detail and a missing body keep the server's message (with the kobo rewording)
    expect(refundErrorMessage("Something odd", { detail: { code: "brand_new_code", message: "Something odd" } })).toBe("Something odd");
    expect(refundErrorMessage("This refund is not pending", { detail: "This refund is not pending" })).toBe("This refund is not pending");
    expect(refundErrorMessage("between 1 and 5500000 kobo", undefined)).toBe(`between ${formatNairaValue(0.01)} and ${formatNairaValue(55000)}`);
  });
});
