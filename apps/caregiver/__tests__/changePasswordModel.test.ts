import { ApiError } from "../src/api/errors";
import {
  DEFAULT_WAIT_SECONDS,
  changePasswordFailure,
  validatePasswordForm,
  weakPasswordMessage,
} from "../src/account/changePasswordModel";

const refusal = (status: number, code: string, message = "m", retryAfter: number | null = null) =>
  new ApiError(status, { detail: { code, message } }, "x", retryAfter);

describe("weakPasswordMessage (mirrors the server's rules)", () => {
  it.each([
    ["short1", "Password must be at least 8 characters."],
    ["aaaaaaaabbbb", "Password is too repetitive."],
    ["Ab1!".repeat(19), "Password must be at most 72 bytes."],
    ["é".repeat(37), "Password must be at most 72 bytes."], // 74 bytes in 37 characters
    ["        ", "Password is too repetitive."],
  ])("refuses %j", (password, message) => {
    expect(weakPasswordMessage(password)).toBe(message);
  });

  it.each(["Brand-New-Pass-42", "abcdefgh", "éèêëàâäôùû".repeat(3), "Ab1!x".repeat(14)])("accepts %j", (password) => {
    expect(weakPasswordMessage(password)).toBeNull();
  });

  it("counts an emoji as one character but four bytes", () => {
    const five = "😀😁😂😃😄";
    expect(weakPasswordMessage(five.repeat(3))).toBeNull(); // 15 characters, 60 bytes
    expect(weakPasswordMessage(five.repeat(4))).toBe("Password must be at most 72 bytes."); // 20 characters, 80 bytes
    expect(weakPasswordMessage("😀".repeat(18))).toBe("Password is too repetitive.");
  });
});

describe("validatePasswordForm", () => {
  const ok = { current: "Old-Password-1", next: "Brand-New-Pass-42", confirm: "Brand-New-Pass-42" };

  it("accepts a valid form", () => expect(validatePasswordForm(ok)).toEqual({}));

  it("asks for every empty field", () => {
    expect(validatePasswordForm({ current: "", next: "", confirm: "" })).toEqual({
      current: "Enter your current password",
      new: "Enter a new password",
      confirm: "Please confirm your new password",
    });
  });

  it("flags a weak new password, the same password and a mismatch", () => {
    expect(validatePasswordForm({ ...ok, next: "short1", confirm: "short1" }).new).toMatch(/at least 8/);
    expect(validatePasswordForm({ ...ok, next: ok.current, confirm: ok.current }).new).toBe("Choose a password you are not using now.");
    expect(validatePasswordForm({ ...ok, confirm: "Different-Pass-1" }).confirm).toBe("Passwords do not match");
  });
});

describe("changePasswordFailure", () => {
  it("puts a wrong current password under the current field", () => {
    expect(changePasswordFailure(refusal(400, "wrong_current_password"))).toEqual({
      kind: "field",
      field: "current",
      message: "Your current password is incorrect.",
    });
  });

  it("puts weak and same passwords under the new field, weak with the server's own words", () => {
    expect(changePasswordFailure(refusal(400, "weak_password", "Password is too repetitive."))).toEqual({
      kind: "field",
      field: "new",
      message: "Password is too repetitive.",
    });
    expect(changePasswordFailure(refusal(400, "same_password"))).toMatchObject({ kind: "field", field: "new" });
  });

  it("reads the wait from Retry-After, with a default when it is missing", () => {
    expect(changePasswordFailure(refusal(429, "too_many_attempts", "m", 120))).toMatchObject({ kind: "wait", seconds: 120 });
    expect(changePasswordFailure(refusal(429, "too_many_attempts"))).toMatchObject({ kind: "wait", seconds: DEFAULT_WAIT_SECONDS });
  });

  it("leaves everything else to the generic message", () => {
    expect(changePasswordFailure(new ApiError(401, { detail: "Could not validate credentials" }, "x"))).toEqual({ kind: "other" });
    expect(changePasswordFailure(new ApiError(0, null, "x"))).toEqual({ kind: "other" });
    expect(changePasswordFailure(new ApiError(422, { detail: [{ type: "missing" }] }, "x"))).toEqual({ kind: "other" });
    expect(changePasswordFailure(refusal(400, "something_new"))).toEqual({ kind: "other" });
    expect(changePasswordFailure(new Error("boom"))).toEqual({ kind: "other" });
  });
});
