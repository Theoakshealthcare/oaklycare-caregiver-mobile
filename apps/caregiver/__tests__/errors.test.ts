import {
  ApiError,
  NETWORK_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  isOfferGone,
  messageForError,
  messageForStatus,
} from "../src/api/errors";
import { unwrap, unwrapEmpty } from "../src/api/unwrap";

function error(status: number, body: unknown): ApiError {
  return new ApiError(status, body, "raw");
}

describe("API error to message mapping", () => {
  it("maps accept 409 to 'taken by another caregiver'", () => {
    const err = error(409, { detail: "Booking is no longer available" });
    expect(messageForError(err, "accept")).toBe("This job was taken by another caregiver.");
  });

  it("maps accept 403 'not approved' to a profile-approval message", () => {
    const err = error(403, { detail: "Your account is not approved to accept bookings" });
    expect(messageForError(err, "accept")).toBe(
      "Your profile isn't approved yet. You can accept jobs once an admin approves it.",
    );
  });

  it("tells apart a job that was never offered to this caregiver", () => {
    const err = error(403, { detail: "You were not offered this booking" });
    expect(messageForError(err, "decline")).toBe("This job is no longer offered to you.");
  });

  it("maps an unpaid booking 409 differently from a taken one", () => {
    const err = error(409, { detail: "Booking has not been paid for" });
    expect(messageForError(err, "accept")).toBe("This job isn't confirmed yet. Please try again shortly.");
  });

  it("maps accept 404", () => {
    expect(messageForError(error(404, { detail: "Booking not found" }), "accept")).toBe(
      "This booking could not be found. It may have been removed.",
    );
  });

  it("a patient token on a caregiver endpoint is a wrong-account message, in any context", () => {
    const err = error(403, { detail: "Access denied. Caregiver account required." });
    expect(messageForError(err, "accept")).toBe("This app is for caregivers. Please use the correct app for your account.");
    expect(messageForError(err)).toBe("This app is for caregivers. Please use the correct app for your account.");
  });

  it("login 401 is a credentials message; any other 401 is an expired session", () => {
    const err = error(401, { detail: "Incorrect email/phone or password" });
    expect(messageForError(err, "login")).toBe("Incorrect email/phone or password.");
    expect(messageForError(error(401, { detail: "Could not validate credentials" }))).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it("network failures (status 0), rate limits and server errors have their own wording", () => {
    expect(messageForError(new ApiError(0, null, "x"))).toBe(NETWORK_MESSAGE);
    expect(messageForStatus(429, null, null, "default")).toBe("Too many attempts. Please wait a moment and try again.");
    expect(messageForError(error(503, { detail: "upstream" }))).toBe(
      "Something went wrong on our side. Please try again in a moment.",
    );
  });

  it("surfaces the server's own sentence for other 4xx, including 422 validation lists", () => {
    expect(messageForError(error(400, { detail: "A user with this email already exists" }))).toBe(
      "A user with this email already exists",
    );
    expect(messageForError(error(400, { detail: "Invalid verification code" }))).toBe("Invalid verification code");
    const validation = error(422, { detail: [{ type: "missing", loc: ["body", "address"], msg: "Field required" }] });
    expect(messageForError(validation)).toBe("Field required");
  });

  it("falls back for anything that is not an ApiError", () => {
    expect(messageForError(new Error("boom"))).toBe("Something went wrong. Please try again.");
    expect(messageForError(undefined)).toBe("Something went wrong. Please try again.");
  });

  it("knows when an offer is gone for good", () => {
    expect(isOfferGone(error(409, { detail: "Booking is no longer available" }))).toBe(true);
    expect(isOfferGone(error(404, { detail: "Booking not found" }))).toBe(true);
    expect(isOfferGone(error(403, { detail: "You were not offered this booking" }))).toBe(true);
    expect(isOfferGone(error(403, { detail: "Your account is not approved to accept bookings" }))).toBe(false);
    expect(isOfferGone(error(500, null))).toBe(false);
  });
});

describe("unwrap", () => {
  const ok = (data: unknown, status = 200) => ({ data, response: new Response(null, { status }) });

  it("returns the typed body on success", async () => {
    await expect(unwrap(Promise.resolve(ok({ a: 1 })))).resolves.toEqual({ a: 1 });
  });

  it("turns an error body into an ApiError carrying status, detail and body", async () => {
    const body = { detail: "Booking is no longer available" };
    const failure = unwrap(Promise.resolve({ error: body, response: new Response(null, { status: 409 }) }));
    await expect(failure).rejects.toMatchObject({ name: "ApiError", status: 409, detail: body.detail, body });
  });

  it("turns a thrown fetch failure into status 0 with the network message", async () => {
    const failure = unwrap(Promise.reject(new TypeError("Network request failed")));
    await expect(failure).rejects.toMatchObject({ status: 0, message: NETWORK_MESSAGE });
  });

  it("does not blame the connection for a failure that is not a fetch rejection", async () => {
    const failure = unwrap(Promise.reject(new Error("could not read the picked file")));
    await expect(failure).rejects.toMatchObject({ name: "ApiError", status: -1 });
    await expect(unwrap(Promise.reject(new Error("x")))).rejects.not.toMatchObject({ message: NETWORK_MESSAGE });
  });

  it("rejects an empty 200 instead of returning undefined as data", async () => {
    await expect(unwrap(Promise.resolve(ok(undefined)))).rejects.toBeInstanceOf(ApiError);
  });

  it("unwrapEmpty accepts a 204 with no body", async () => {
    await expect(unwrapEmpty(Promise.resolve(ok(undefined, 204)))).resolves.toBeUndefined();
  });
});
