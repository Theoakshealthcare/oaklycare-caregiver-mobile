import { describe, expect, it } from "vitest";

import { extractInviteToken, parseAdminList } from "./admin-auth-contract";
import { formatAge, formatNaira, formatWat, formatWatDate, humanize } from "./format";
import { safeNext } from "./redirect";

describe("format", () => {
  it("shows times in WAT (UTC+1), treating naive backend timestamps as UTC", () => {
    expect(formatWat("2026-10-06T13:05:00")).toBe("6 Oct 2026, 14:05 WAT");
    expect(formatWat("2026-10-06T13:05:00Z")).toBe("6 Oct 2026, 14:05 WAT");
    expect(formatWatDate("2026-10-06T23:30:00Z")).toBe("7 Oct 2026");
    expect(formatWat(null)).toBe("—");
    expect(formatWat("not a date")).toBe("—");
  });

  it("formats kobo as naira", () => {
    expect(formatNaira(4_400_000)).toBe("₦44,000");
    expect(formatNaira(4_400_050)).toBe("₦44,000.50");
    expect(formatNaira(0)).toBe("₦0");
    expect(formatNaira(null)).toBe("—");
  });

  it("formats ages and statuses", () => {
    expect(formatAge(0)).toBe("Today");
    expect(formatAge(1)).toBe("1 day");
    expect(formatAge(5)).toBe("5 days");
    expect(humanize("changes_requested")).toBe("Changes requested");
  });
});

describe("safeNext", () => {
  it("accepts only same-origin paths", () => {
    expect(safeNext("/caregivers/applications?status=approved")).toBe("/caregivers/applications?status=approved");
    expect(safeNext("https://evil.test")).toBe("/");
    expect(safeNext("//evil.test")).toBe("/");
    expect(safeNext("/\\evil.test")).toBe("/");
    expect(safeNext("/login")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("admin contract helpers", () => {
  it("extracts the invite token whichever way the backend names it", () => {
    expect(extractInviteToken({ invite_token: "t1" })).toBe("t1");
    expect(extractInviteToken({ token: "t2" })).toBe("t2");
    expect(extractInviteToken({ invite_url: "https://console.test/accept-invite?token=t3" })).toBe("t3");
    expect(extractInviteToken({})).toBeNull();
  });

  it("accepts a bare array or an items envelope for the admin list", () => {
    const row = { id: "1", email: "a@example.test", full_name: "A", roles: [], status: "active" };
    expect(parseAdminList([row])).toHaveLength(1);
    expect(parseAdminList({ items: [row] })).toHaveLength(1);
    expect(parseAdminList(null)).toEqual([]);
  });
});
