import { describe, expect, it } from "vitest";

import { FAILING, LATE_SUCCESS, OTP_STUCK, makePayout } from "@/test/payout-fixtures";

import { canCancelPayout, canResolvePayout, canRetryPayout, groupFrozen } from "./payouts";

describe("payout state machine", () => {
  it("cancel only before approval", () => {
    expect(canCancelPayout(makePayout())).toBe(true);
    expect(canCancelPayout(OTP_STUCK)).toBe(false);
  });
  it("retry only failed/reversed and never for a frozen caregiver", () => {
    expect(canRetryPayout(FAILING)).toBe(true);
    expect(canRetryPayout({ ...FAILING, status: "reversed" })).toBe(true);
    expect(canRetryPayout({ ...FAILING, caregiver_payouts_frozen_at: "2026-10-12T16:52:20" })).toBe(false);
    expect(canRetryPayout(LATE_SUCCESS)).toBe(false);
  });
  it("resolve only processing or needs_attention", () => {
    expect(canResolvePayout(OTP_STUCK)).toBe(true);
    expect(canResolvePayout(LATE_SUCCESS)).toBe(true);
    expect(canResolvePayout(FAILING)).toBe(false);
  });
});

describe("groupFrozen", () => {
  it("groups by caregiver, sums shortfall and counts open payouts; skips unfrozen caregivers", () => {
    const second = { ...LATE_SUCCESS, id: "other", status: "failed" as const, shortfall_kobo: 100 };
    const rows = groupFrozen([LATE_SUCCESS, second, FAILING]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ caregiverId: LATE_SUCCESS.caregiver_id, shortfallKobo: 800100, openCount: 1 });
  });
});
