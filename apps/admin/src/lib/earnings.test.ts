import { describe, expect, it } from "vitest";

import { jsonResponse, stubFetch } from "@/test/helpers";
import { ADMIN_HOLD, NO_SHOW, PENDING, RELEASED, SHORT_VISIT, VOIDED, makeEarning } from "@/test/earning-fixtures";

import {
  canHold,
  canReleaseHold,
  canVoid,
  clearanceHasPassed,
  fetchAllHeld,
  holdKind,
  isAdminHold,
  needsReview,
  reasonSummary,
} from "./earnings";

describe("holdKind", () => {
  it("reads why a held earning is held from the reason and who changed it", () => {
    expect(holdKind(SHORT_VISIT)).toBe("short_visit");
    expect(holdKind(NO_SHOW)).toBe("no_show");
    expect(holdKind(ADMIN_HOLD)).toBe("admin");
    // A hold with no admin attached and wording we don't know is still the system's.
    expect(holdKind({ status: "held", status_reason: "Something new", status_changed_by: null })).toBe("system");
  });

  it("also recognises the no-show hold the flag action puts on an already-pending earning", () => {
    expect(holdKind({ ...NO_SHOW, status_reason: "No-show flagged: caregiver never arrived" })).toBe("no_show");
  });

  it("only applies to held earnings", () => {
    for (const e of [PENDING, RELEASED, VOIDED]) expect(holdKind(e)).toBeNull();
  });

  it("splits held earnings into review and admin holds", () => {
    expect([SHORT_VISIT, NO_SHOW, ADMIN_HOLD].map(needsReview)).toEqual([true, true, false]);
    expect([SHORT_VISIT, NO_SHOW, ADMIN_HOLD].map(isAdminHold)).toEqual([false, false, true]);
    expect(needsReview(PENDING)).toBe(false);
  });
});

describe("what can be done, by status", () => {
  it("allows hold only on pending, release-hold only on held, void on both, nothing once released or voided", () => {
    expect([PENDING, SHORT_VISIT, RELEASED, VOIDED].map(canHold)).toEqual([true, false, false, false]);
    expect([PENDING, SHORT_VISIT, RELEASED, VOIDED].map(canReleaseHold)).toEqual([false, true, false, false]);
    expect([PENDING, SHORT_VISIT, RELEASED, VOIDED].map(canVoid)).toEqual([true, true, false, false]);
  });
});

describe("reasonSummary", () => {
  it("gives the hold, void or release reason in the words it was written in", () => {
    expect(reasonSummary(SHORT_VISIT)).toMatch(/^Short visit: under 50%/);
    expect(reasonSummary(VOIDED)).toBe("Voided: Visit never took place");
    expect(reasonSummary(makeEarning({ status_reason: "Family confirmed the visit" }))).toBe("Hold released: Family confirmed the visit");
    expect(reasonSummary(PENDING)).toBeNull();
    expect(reasonSummary(RELEASED)).toBeNull();
  });
});

describe("clearanceHasPassed", () => {
  it("treats the backend's zone-less timestamps as UTC", () => {
    const at = Date.parse("2026-11-25T12:00:00Z");
    expect(clearanceHasPassed({ available_at: "2026-11-25T11:59:59" }, at)).toBe(true);
    expect(clearanceHasPassed({ available_at: "2026-11-25T12:00:01" }, at)).toBe(false);
    expect(clearanceHasPassed({ available_at: null }, at)).toBe(false);
  });
});

describe("fetchAllHeld", () => {
  it("reads every page of held earnings, 200 at a time", async () => {
    const first = Array.from({ length: 200 }, (_, i) => makeEarning({ id: `a-${i}`, status: "held" }));
    const second = [makeEarning({ id: "b-0", status: "held" })];
    const calls = stubFetch({
      "GET /api/v1/admin/earnings": (req) => {
        const offset = new URL(req.url).searchParams.get("offset");
        return jsonResponse({ items: offset === "0" ? first : second, total: 201 });
      },
    });
    const res = await fetchAllHeld();
    expect(res.items).toHaveLength(201);
    expect(res.total).toBe(201);
    expect(calls.map((c) => c.search)).toEqual(["?status=held&limit=200&offset=0", "?status=held&limit=200&offset=200"]);
  });
});
