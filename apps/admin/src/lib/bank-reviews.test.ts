import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import { accountEnding, isConflict } from "@/lib/bank-reviews";

describe("accountEnding", () => {
  it("takes the last four digits of the masked number, for titles", () => {
    expect(accountEnding({ account_number: "******0011" })).toBe("0011");
  });
});

describe("isConflict", () => {
  it("is true only for an ApiError with status 409", () => {
    expect(isConflict(new ApiError("x", 409, undefined))).toBe(true);
    expect(isConflict(new ApiError("x", 403, undefined))).toBe(false);
    expect(isConflict(new Error("x"))).toBe(false);
    expect(isConflict("409")).toBe(false);
  });
});
