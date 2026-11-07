import { resolveGate, type GateInput } from "../src/navigation/gate";

const me = { user_type: "patient", is_verified: true, email: "ada.placeholder@example.com" };
const idle = { data: undefined, isError: false };

function input(overrides: Partial<GateInput>): GateInput {
  return { session: "signedIn", me: { data: me, isError: false }, ...overrides };
}

describe("auth gate", () => {
  it("shows the splash while the session is restoring", () => {
    expect(resolveGate(input({ session: "restoring" }))).toEqual({ kind: "loading" });
  });

  it("sends a signed-out user to login, whatever /auth/me holds", () => {
    expect(resolveGate(input({ session: "signedOut", me: idle }))).toEqual({ kind: "signedOut" });
    expect(resolveGate(input({ session: "signedOut" }))).toEqual({ kind: "signedOut" });
  });

  it("waits for /auth/me", () => {
    expect(resolveGate(input({ me: idle }))).toEqual({ kind: "loading" });
  });

  it("offers a retry when the first load fails, but keeps going on a failed background refetch", () => {
    expect(resolveGate(input({ me: { data: undefined, isError: true } }))).toEqual({ kind: "error" });
    expect(resolveGate(input({ me: { data: me, isError: true } }))).toEqual({ kind: "app" });
  });

  it("refuses a caregiver account", () => {
    expect(resolveGate(input({ me: { data: { ...me, user_type: "caregiver" }, isError: false } }))).toEqual({
      kind: "wrongAccount",
    });
  });

  it("holds an unverified email at the verify placeholder", () => {
    expect(resolveGate(input({ me: { data: { ...me, is_verified: false }, isError: false } }))).toEqual({
      kind: "verifyEmail",
      email: "ada.placeholder@example.com",
    });
  });

  it("lets a verified patient into the app", () => {
    expect(resolveGate(input({}))).toEqual({ kind: "app" });
  });
});
