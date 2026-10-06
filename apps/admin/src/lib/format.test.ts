import { describe, expect, it } from "vitest";

import { ADMIN_ROLES, KNOWN_PERMISSIONS, classifyLogin } from "./admin-auth-contract";
import { NAV } from "./nav";
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

describe("admin contract", () => {
  it("narrows the loosely typed login response by which keys are present", () => {
    expect(classifyLogin({ mfa_required: true, mfa_token: "t" })).toEqual({ kind: "mfa", mfaToken: "t" });
    expect(
      classifyLogin({ mfa_enrollment_required: true, mfa_token: "t", otpauth_uri: "otpauth://x", secret: "S" }),
    ).toEqual({ kind: "enroll", mfaToken: "t", otpauthUri: "otpauth://x", secret: "S" });
    expect(classifyLogin({ mfa_token: "t" })).toBeNull();
    // Enrolment without its secret would show an unusable screen; refuse it.
    expect(classifyLogin({ mfa_enrollment_required: true, mfa_token: "t" })).toBeNull();
  });

  it("only asks for permissions the backend defines", () => {
    for (const group of NAV) for (const item of group.items) for (const p of item.anyOf) expect(KNOWN_PERMISSIONS.has(p)).toBe(true);
  });

  it("covers the seven role keys from the guide", () => {
    expect(ADMIN_ROLES.map((r) => r.slug).sort()).toEqual(
      ["clinical_reviewer", "finance", "operations", "read_only_analyst", "super_admin", "support", "verification"],
    );
  });
});
