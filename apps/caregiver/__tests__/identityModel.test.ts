import { ApiError } from "../src/api/errors";
import { parseKycMode, kycEnabled } from "../src/identity/config";
import {
  CONSENT_BODY,
  STILL_CHECKING_TEXT,
  canContinueVerification,
  CONSENT_TEXT_VERSION,
  POLL_DELAY_MS,
  asksConsent,
  attemptLabel,
  canDefer,
  identityErrorCode,
  isSlow,
  nextRouteAfterIdentity,
  pollStageAt,
  resolveIdentityScreen,
  reviewEtaText,
  shouldPoll,
  tipFor,
  type IdentityPhase,
  type IdentityScreen,
  type IdentityState,
} from "../src/identity/identityModel";
import {
  checking,
  errored,
  exhausted,
  expired,
  fresh,
  providerDown,
  rejected,
  started,
  tryAgain,
  underReview,
  verified,
} from "../test-utils/identityFixtures";

const idle: IdentityPhase = { kind: "idle" };
const screenOf = (state: IdentityState | undefined, phase: IdentityPhase = idle, loadError?: unknown) =>
  resolveIdentityScreen({ state, phase, loadError });

describe("resolveIdentityScreen: server states (design 11.3)", () => {
  it.each<[string, IdentityState, IdentityScreen]>([
    ["fresh caregiver", fresh(), "intro"],
    ["widget opened, not finished", started(), "resume"],
    ["widget finished, waiting for the partner", checking(), "checking"],
    ["passed", verified(), "verified"],
    ["clean failure with attempts left", tryAgain(), "tryAgain"],
    ["all attempts used", exhausted(), "exhausted"],
    ["a person is looking at it", underReview(), "underReview"],
    ["verification down", providerDown(), "unavailable"],
    ["timed out", expired(), "expired"],
    ["our side errored", errored(), "error"],
    ["a person turned the identity down", rejected(), "rejected"],
  ])("%s", (_name, state, expected) => {
    expect(screenOf(state)).toBe(expected);
  });

  it("loads, fails and goes offline before there is any state", () => {
    expect(screenOf(undefined)).toBe("loading");
    expect(screenOf(undefined, idle, new ApiError(500, null, "boom"))).toBe("loadError");
    expect(screenOf(undefined, idle, new ApiError(0, null, "offline"))).toBe("offline");
  });

  it("a running attempt while the provider is down shows the outage, but a waiting one keeps checking", () => {
    expect(screenOf({ ...started(), provider_available: false })).toBe("unavailable");
    expect(screenOf({ ...checking(), provider_available: false })).toBe("checking");
  });

  it("asks the user to update the app when the server's consent text version is not the one shown", () => {
    expect(screenOf({ ...fresh(), policy_version: "kyc-2027-01" })).toBe("updateRequired");
    expect(screenOf({ ...tryAgain(), policy_version: "kyc-2027-01" })).toBe("updateRequired");
    expect(CONSENT_TEXT_VERSION).toBe(fresh().policy_version);
  });

  it("falls back to 'exhausted' when nothing can be started and nothing is running", () => {
    expect(screenOf({ ...fresh(), can_start: false })).toBe("exhausted");
    expect(screenOf({ ...expired(), can_start: false })).toBe("exhausted");
  });
});

describe("resolveIdentityScreen: the server's decision beats the widget", () => {
  const phases: IdentityPhase[] = [
    { kind: "starting" },
    { kind: "widget" },
    { kind: "submitted" },
    { kind: "closed" },
    { kind: "widgetError" },
    { kind: "permissionDenied" },
  ];

  it.each(phases.map((p) => [p.kind, p] as const))("%s never hides verified, review or a person's rejection", (_k, phase) => {
    expect(screenOf(verified(), phase)).toBe("verified");
    expect(screenOf(underReview(), phase)).toBe("underReview");
    expect(screenOf(rejected(), phase)).toBe("rejected");
  });

  it("shows the widget moments while the caregiver is still pending or in progress", () => {
    expect(screenOf(fresh(), { kind: "starting" })).toBe("starting");
    expect(screenOf(started(), { kind: "widget" })).toBe("widget");
    expect(screenOf(started(), { kind: "closed" })).toBe("closed");
    expect(screenOf(started(), { kind: "widgetError" })).toBe("widgetError");
    expect(screenOf(started(), { kind: "permissionDenied" })).toBe("permissionDenied");
  });

  it("'submitted' means checking only while the server still shows a running attempt", () => {
    expect(screenOf(started(), { kind: "submitted" })).toBe("checking");
    expect(screenOf(tryAgain(), { kind: "submitted" })).toBe("tryAgain");
    expect(screenOf(verified(), { kind: "submitted" })).toBe("verified");
  });

  it("a failed start leaves the screen the server state gives", () => {
    expect(screenOf(fresh(), { kind: "startFailed", code: null, message: "x" })).toBe("intro");
    expect(screenOf(verified(), { kind: "startFailed", code: "ALREADY_VERIFIED", message: "" })).toBe("verified");
  });
});

describe("small rules", () => {
  it("counts attempts: a running attempt is already counted, a new one is the next", () => {
    expect(attemptLabel(tryAgain(), "tryAgain")).toBe("Attempt 2 of 3");
    expect(attemptLabel(started(), "resume")).toBe("Attempt 1 of 3");
    expect(attemptLabel(checking(), "checking")).toBe("Attempt 1 of 3");
    expect(attemptLabel(fresh(), "intro")).toBe("Attempt 1 of 3");
    expect(attemptLabel(exhausted(), "tryAgain")).toBe("Attempt 3 of 3");
  });

  it("asks consent exactly where a new attempt starts", () => {
    const asks: IdentityScreen[] = ["intro", "tryAgain", "expired", "error"];
    expect(asks.every(asksConsent)).toBe(true);
    for (const s of ["resume", "closed", "widgetError", "checking", "verified"] as const) expect(asksConsent(s)).toBe(false);
  });

  it("gives a tip per hint, never a reason", () => {
    expect(tipFor("lighting")).toMatch(/good light/);
    expect(tipFor("document")).toMatch(/flat/);
    expect(tipFor("mismatch_generic")).toMatch(/name/);
    expect(tipFor(null)).toMatch(/good light/);
  });

  it("says how long a review takes from the server's number", () => {
    expect(reviewEtaText(24)).toBe("usually within 24 hours");
    expect(reviewEtaText(null)).toBe("as soon as they can");
  });

  it("offers 'continue without' only while verification is down and the caregiver is not decided", () => {
    expect(canDefer(providerDown())).toBe(true);
    expect(canDefer(fresh())).toBe(false);
    expect(canDefer({ ...underReview(), provider_available: false })).toBe(false);
    expect(canDefer({ ...verified(), provider_available: false })).toBe(false);
    expect(canDefer(undefined)).toBe(false);
  });

  it("reads the machine code of an identity error", () => {
    const body = { detail: { code: "ATTEMPTS_EXHAUSTED", message: "x" } };
    expect(identityErrorCode(new ApiError(409, body, "x"))).toBe("ATTEMPTS_EXHAUSTED");
    expect(identityErrorCode(new ApiError(409, { detail: "plain" }, "x"))).toBeNull();
    expect(identityErrorCode(new Error("x"))).toBeNull();
  });

  it("goes on to consent during onboarding and back to the status screen in the status stack", () => {
    expect(nextRouteAfterIdentity(["CaregiverSetupStep1", "ConsentScreen"])).toBe("ConsentScreen");
    expect(nextRouteAfterIdentity(["VerificationStatus", "CaregiverSetupStep1"])).toBe("VerificationStatus");
    expect(nextRouteAfterIdentity(undefined)).toBe("VerificationStatus");
  });

  it("polls only while a result is awaited", () => {
    expect(shouldPoll("checking")).toBe(true);
    for (const s of ["intro", "resume", "widget", "verified", "underReview", "unavailable", "tryAgain"] as const) {
      expect(shouldPoll(s)).toBe(false);
    }
  });
});

describe("polling cadence", () => {
  it("backs off from 3 s to 10 s and gives up after 5 minutes", () => {
    expect(pollStageAt(0)).toBe("fast");
    expect(POLL_DELAY_MS[pollStageAt(29_999)]).toBe(3_000);
    expect(POLL_DELAY_MS[pollStageAt(30_000)]).toBe(5_000);
    expect(POLL_DELAY_MS[pollStageAt(60_000)]).toBe(10_000);
    expect(POLL_DELAY_MS[pollStageAt(299_999)]).toBe(10_000);
    expect(POLL_DELAY_MS[pollStageAt(300_000)]).toBe(false);
  });

  it("calls it slow from one minute", () => {
    expect(isSlow(59_999)).toBe(false);
    expect(isSlow(60_000)).toBe(true);
  });
});

describe("consent copy and the feature switch", () => {
  it("keeps the points the design requires in the separate consent", () => {
    for (const phrase of ["National ID (NIN or BVN)", "live photo of your face", "not your ID or your photo", "delete your data", "a member of our team reviews it"]) {
      expect(CONSENT_BODY).toContain(phrase);
    }
  });

  it("is off unless mock or api is asked for", () => {
    expect(parseKycMode(undefined)).toBe("off");
    expect(parseKycMode("")).toBe("off");
    expect(parseKycMode("true")).toBe("off");
    expect(parseKycMode("mock")).toBe("mock");
    expect(parseKycMode("api")).toBe("api");
    expect(kycEnabled("off")).toBe(false);
    expect(kycEnabled("mock")).toBe(true);
    expect(kycEnabled("api")).toBe(true);
  });
});

describe("Continue verification (after the browser was dismissed)", () => {
  it("is offered only after a dismissal, with the attempt still open and not yet heard as completed", () => {
    expect(canContinueVerification(started(), { kind: "submitted", dismissed: true })).toBe(true);
    // came back through the return page, or never launched
    expect(canContinueVerification(started(), { kind: "submitted" })).toBe(false);
    expect(canContinueVerification(started(), { kind: "idle" })).toBe(false);
    // the server has "completed": a second run under one reference is ambiguous
    expect(canContinueVerification(checking(), { kind: "submitted", dismissed: true })).toBe(false);
    // no open attempt any more (expired, failed, decided)
    expect(canContinueVerification(fresh(), { kind: "submitted", dismissed: true })).toBe(false);
    expect(canContinueVerification(undefined, { kind: "submitted", dismissed: true })).toBe(false);
  });

  it("waits on the server after a dismissal: Checking while the attempt is open, otherwise the server's own screen", () => {
    const phase = { kind: "submitted", dismissed: true } as const;
    expect(resolveIdentityScreen({ state: started(), phase })).toBe("checking");
    expect(resolveIdentityScreen({ state: tryAgain(), phase })).toBe("tryAgain");
    expect(resolveIdentityScreen({ state: expired(), phase })).toBe("expired");
    expect(resolveIdentityScreen({ state: verified(), phase })).toBe("verified");
  });
});

describe("copy", () => {
  it("promises nothing a failure would, and names no retired provider", () => {
    expect(STILL_CHECKING_TEXT).toBe(
      "Still checking. This can take a few minutes. You can leave this screen; we will tell you when it is done.",
    );
    expect(CONSENT_BODY).toContain("Dojah");
    expect(CONSENT_BODY).not.toMatch(/prembly/i);
  });
});
