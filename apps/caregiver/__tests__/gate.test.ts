import { resolveGate, setupRouteFor, type GateInput } from "../src/navigation/gate";
import {
  parseVerificationStatus,
  type ProfileStatus,
  type VerificationStatus,
} from "../src/services/caregiver.service";
import { statusCopy } from "../src/screens/setup/VerificationStatus";

const me = { user_type: "caregiver", is_verified: true, email: "caregiver@example.com" };

function status(profileStatus: ProfileStatus, step = 2): VerificationStatus {
  return {
    profileStatus,
    profileCompletionStep: step,
    identityVerificationStatus: "pending",
    backgroundCheckStatus: "pending",
    rejectionReason: null,
    changesRequested: null,
  };
}

const idle = { data: undefined, isError: false };
function input(overrides: Partial<GateInput>): GateInput {
  return { session: "signedIn", me: { data: me, isError: false }, status: { data: status("approved"), isError: false }, ...overrides };
}

describe("auth gate", () => {
  it("shows the splash while the session is restoring", () => {
    expect(resolveGate(input({ session: "restoring" }))).toEqual({ kind: "loading" });
  });

  it("sends a signed-out user to onboarding/login", () => {
    expect(resolveGate(input({ session: "signedOut", me: idle, status: idle }))).toEqual({ kind: "signedOut" });
  });

  it("waits for /auth/me and the verification status", () => {
    expect(resolveGate(input({ me: idle, status: idle }))).toEqual({ kind: "loading" });
    expect(resolveGate(input({ status: idle }))).toEqual({ kind: "loading" });
  });

  it("offers a retry when a first load fails, but keeps going on a failed background refetch", () => {
    expect(resolveGate(input({ me: { data: undefined, isError: true } }))).toEqual({ kind: "error" });
    expect(resolveGate(input({ status: { data: undefined, isError: true } }))).toEqual({ kind: "error" });
    expect(resolveGate(input({ status: { data: status("approved"), isError: true } }))).toEqual({ kind: "app" });
  });

  it("rejects a patient account", () => {
    expect(resolveGate(input({ me: { data: { ...me, user_type: "patient" }, isError: false } }))).toEqual({
      kind: "wrongAccount",
    });
  });

  it("asks an unverified email to be verified before anything else", () => {
    expect(resolveGate(input({ me: { data: { ...me, is_verified: false }, isError: false }, status: idle }))).toEqual({
      kind: "verifyEmail",
      email: "caregiver@example.com",
    });
  });

  it("resumes onboarding at the step the backend says", () => {
    expect(setupRouteFor(0)).toBe("CaregiverSetupStep1");
    expect(setupRouteFor(1)).toBe("CaregiverSetupStep2");
    expect(setupRouteFor(2)).toBe("ConsentScreen");
    expect(resolveGate(input({ status: { data: status("incomplete", 1), isError: false } }))).toEqual({
      kind: "setup",
      initialRoute: "CaregiverSetupStep2",
    });
  });

  it.each(["under_review", "changes_requested", "rejected", "suspended"] as const)(
    "shows the status screen for %s",
    (profileStatus) => {
      expect(resolveGate(input({ status: { data: status(profileStatus), isError: false } }))).toEqual({
        kind: "status",
        status: profileStatus,
      });
    },
  );

  it("lets an approved caregiver into the app", () => {
    expect(resolveGate(input({}))).toEqual({ kind: "app" });
  });
});

describe("verification status", () => {
  // Bodies copied from the backend guide captures 037-b, 040-b and 014-a.
  it("parses changes_requested with its items and note", () => {
    const parsed = parseVerificationStatus({
      profile_completion_step: 2,
      identity_verification_status: "pending",
      background_check_status: "in_progress",
      profile_status: "changes_requested",
      rejection_reason: null,
      changes_requested: { items: ["Upload a clearer licence photo"], note: "Placeholder: the licence image is blurry." },
    });
    expect(parsed.profileStatus).toBe("changes_requested");
    expect(parsed.changesRequested).toEqual({
      items: ["Upload a clearer licence photo"],
      note: "Placeholder: the licence image is blurry.",
    });
    expect(parsed.rejectionReason).toBeNull();
  });

  it("parses rejected with its reason, and incomplete with null extras", () => {
    const rejected = parseVerificationStatus({
      profile_completion_step: 2,
      identity_verification_status: "pending",
      background_check_status: "in_progress",
      profile_status: "rejected",
      rejection_reason: "Placeholder: licence could not be verified.",
      changes_requested: null,
    });
    expect(rejected.rejectionReason).toBe("Placeholder: licence could not be verified.");
    expect(statusCopy(rejected).body).toBe("Placeholder: licence could not be verified.");

    const fresh = parseVerificationStatus({
      profile_completion_step: 0,
      identity_verification_status: "pending",
      background_check_status: "pending",
      profile_status: "incomplete",
      rejection_reason: null,
      changes_requested: null,
    });
    expect(fresh.changesRequested).toBeNull();
  });

  it("refuses a status it does not know instead of guessing", () => {
    expect(() => parseVerificationStatus({ profile_status: "teleported" })).toThrow("Unexpected profile_status");
  });

  it("has distinct copy for each blocked status", () => {
    const titles = (["under_review", "changes_requested", "rejected", "suspended"] as const).map(
      (s) => statusCopy(status(s)).title,
    );
    expect(new Set(titles).size).toBe(4);
  });
});
