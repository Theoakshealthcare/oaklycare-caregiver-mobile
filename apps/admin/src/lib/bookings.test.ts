import { describe, expect, it } from "vitest";

import { CAREGIVER_ONE, POLICY, makeDetail } from "@/test/booking-fixtures";

import {
  EMPTY_FILTERS,
  cancelEstimate,
  correctionTargets,
  insideNigeria,
  listQuery,
  parseNairaToKobo,
  watDayStartUtc,
} from "./bookings";

const caregiver = { id: CAREGIVER_ONE, full_name: "Placeholder Nurse One", phone: null, masked: false };
// The fixture's visit starts 2026-10-08T01:38:05Z.
const hoursBefore = (h: number) => new Date(Date.parse("2026-10-08T01:38:05.522Z") - h * 3_600_000);

describe("listQuery", () => {
  it("sends only the chosen filters, with paging", () => {
    expect(listQuery(EMPTY_FILTERS, 50)).toEqual({ limit: 25, offset: 50 });
  });

  it("maps every filter to the backend's parameter names", () => {
    expect(
      listQuery(
        {
          q: "  12FF3CB2 ",
          status: "pending",
          paymentStatus: "paid",
          dispatchState: "unmatched",
          channel: "whatsapp",
          city: " Lagos ",
          scheduledFrom: "2026-10-10",
          scheduledTo: "2026-10-12",
          needsAddressCheck: true,
          noShow: true,
        },
        0,
      ),
    ).toEqual({
      limit: 25,
      offset: 0,
      q: "12FF3CB2",
      status: "pending",
      payment_status: "paid",
      dispatch_state: "unmatched",
      channel: "whatsapp",
      city: "Lagos",
      scheduled_from: "2026-10-09T23:00:00",
      // `to` is exclusive: the end of the 12th in WAT is the start of the 13th.
      scheduled_to: "2026-10-12T23:00:00",
      needs_address_check: true,
      no_show: true,
    });
  });
});

describe("watDayStartUtc", () => {
  it("turns a WAT day into naive UTC, rolling over month ends", () => {
    expect(watDayStartUtc("2026-11-01")).toBe("2026-10-31T23:00:00");
    expect(watDayStartUtc("2026-10-31", 1)).toBe("2026-10-31T23:00:00");
  });
});

describe("correctionTargets", () => {
  it("moves forward only", () => {
    expect(correctionTargets("accepted")).toEqual(["en_route", "in_progress", "completed"]);
    expect(correctionTargets("en_route")).toEqual(["in_progress", "completed"]);
    expect(correctionTargets("in_progress")).toEqual(["completed"]);
    expect(correctionTargets("pending")).toEqual([]);
    expect(correctionTargets("completed")).toEqual([]);
  });
});

describe("insideNigeria", () => {
  it("accepts Lagos and refuses a swapped or foreign pair", () => {
    expect(insideNigeria(6.4474, 3.4723)).toBe(true);
    expect(insideNigeria(3.4723, 6.4474)).toBe(false);
    expect(insideNigeria(51.5, -0.12)).toBe(false);
  });
});

describe("parseNairaToKobo", () => {
  it("parses naira with commas, a sign and kobo", () => {
    expect(parseNairaToKobo("₦12,500.50")).toBe(1250050);
    expect(parseNairaToKobo("27500")).toBe(2750000);
  });
  it("refuses zero, negatives, junk and more than two decimals", () => {
    for (const bad of ["0", "-5", "abc", "1.234", ""]) expect(parseNairaToKobo(bad)).toBeNull();
  });
});

describe("cancelEstimate", () => {
  it("is a full refund while nobody is assigned", () => {
    expect(cancelEstimate(makeDetail(), POLICY, hoursBefore(1))).toEqual({
      tier: "free",
      feePercent: 0,
      feeKobo: 0,
      refundKobo: 5500000,
      dependsOnOnMyWay: false,
    });
  });

  it("is a full refund for an accepted visit further away than the free window", () => {
    expect(cancelEstimate(makeDetail({ status: "accepted", caregiver }), POLICY, hoursBefore(13))?.tier).toBe("free");
  });

  it("charges the standard fee (of the service fee, not the total) between the two lines", () => {
    // 20% of ₦50,000 service fee = ₦10,000; refund ₦55,000 - ₦10,000.
    expect(cancelEstimate(makeDetail({ status: "accepted", caregiver }), POLICY, hoursBefore(12))).toEqual({
      tier: "standard",
      feePercent: 20,
      feeKobo: 1000000,
      refundKobo: 4500000,
      dependsOnOnMyWay: false,
    });
  });

  it("charges the late fee inside the late window and after the start", () => {
    const late = cancelEstimate(makeDetail({ status: "accepted", caregiver }), POLICY, hoursBefore(1));
    expect(late).toMatchObject({ tier: "late", feePercent: 50, feeKobo: 2500000, refundKobo: 3000000, dependsOnOnMyWay: false });
    expect(cancelEstimate(makeDetail({ status: "accepted", caregiver }), POLICY, hoursBefore(-3))?.tier).toBe("late");
  });

  it("marks an en-route booking outside the late window as depending on the on-my-way tap", () => {
    expect(cancelEstimate(makeDetail({ status: "en_route", caregiver }), POLICY, hoursBefore(5))).toMatchObject({
      tier: "late",
      dependsOnOnMyWay: true,
    });
  });

  it("has nothing to say for an unpaid or closed booking", () => {
    const unpaid = makeDetail({ payment: { ...makeDetail().payment, status: "pending" } });
    expect(cancelEstimate(unpaid, POLICY, hoursBefore(1))).toBeNull();
    expect(cancelEstimate(makeDetail({ status: "in_progress", caregiver }), POLICY, hoursBefore(1))).toBeNull();
  });
});
