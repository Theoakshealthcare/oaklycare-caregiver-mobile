import { describe, expect, it } from "vitest";

import { safeNext } from "./redirect";

describe("safeNext (open redirect guard)", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/caregivers/applications?status=approved&page=1#top", "/caregivers/applications?status=approved&page=1#top"],
    ["/%2F%2Fevil.com", "/%2F%2Fevil.com"],
  ])("keeps the same-origin path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["/\t/evil.com"],
    ["/\n/evil.com"],
    ["/\r/evil.com"],
    ["/ /evil.com"],
    ["\t//evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
    ["/login?next=x"],
    ["/login"],
    ["/api/x"],
    [""],
    [null],
    [undefined],
  ])("falls back to / for %j", (input) => {
    expect(safeNext(input)).toBe("/");
  });

  it("never returns a protocol-relative or absolute URL for tab/newline tricks", () => {
    for (const ch of ["\t", "\n", "\r", "\u0000", "\u007f", " "]) {
      const out = safeNext(`/${ch}/evil.com`);
      expect(out.startsWith("//")).toBe(false);
      expect(out).toBe("/");
    }
  });

  it.each([["/.//evil.com"], ["/a/..//evil.com"], ["/./\\evil.com"], ["/x/../\\/evil.com"], ["/%2e//evil.com"]])(
    "dot segments that normalise to a protocol-relative path never escape: %j",
    (input) => {
      const out = safeNext(input);
      expect(out.startsWith("//")).toBe(false);
      expect(out.startsWith("/\\")).toBe(false);
      expect(new URL(out, "https://admin.example.com").origin).toBe("https://admin.example.com");
    },
  );
});

