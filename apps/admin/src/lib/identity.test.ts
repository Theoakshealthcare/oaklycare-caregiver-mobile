import { describe, expect, it } from "vitest";

import { asIdentityStatus, matchWords, reasonWords, scoreWords } from "./identity";

describe("identity copy", () => {
  it("turns a known reason code into words and leaves an unknown one as it is", () => {
    expect(reasonWords("face_grey_band")).toMatch(/between the floor and the pass mark/);
    expect(reasonWords("admin_reset")).toMatch(/no longer counts/);
    expect(reasonWords("something_new")).toBe("something_new");
  });

  it("says what a null match means", () => {
    expect(matchWords(true)).toBe("Matches the profile");
    expect(matchWords(false)).toBe("Differs from the profile");
    expect(matchWords(null)).toBe("Not compared");
  });

  it("prints scores as sent and null as not reported", () => {
    expect(scoreWords(92)).toBe("92");
    expect(scoreWords(92.5)).toBe("92.5");
    expect(scoreWords(0)).toBe("0");
    expect(scoreWords(null)).toBe("Not reported");
  });

  it("only passes a known status as expected_status", () => {
    expect(asIdentityStatus("needs_review")).toBe("needs_review");
    expect(asIdentityStatus("surprise")).toBeUndefined();
  });
});
