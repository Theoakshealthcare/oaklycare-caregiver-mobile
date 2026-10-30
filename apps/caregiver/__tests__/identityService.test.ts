import { ApiError } from "../src/api/errors";
import { identityErrorCode } from "../src/identity/identityModel";
import { createMockIdentityService, parseMockScenario } from "../src/identity/mockIdentityService";
import { identityService, parseSession, setIdentityService } from "../src/services/identity.service";
import { VERIFICATION_ID, WIDGET_URL, session, sessionWithUrl, started, tryAgain } from "../test-utils/identityFixtures";

// The app's client captures `fetch` when it is created, so route it through a late-bound wrapper.
jest.mock("../src/api/client", () => {
  const { createOaklyClient } = jest.requireActual("@oakly/api-client");
  return {
    api: createOaklyClient({
      baseUrl: "http://test.local",
      getAccessToken: () => "access",
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    }),
  };
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("real service: request wiring (against the backend's captured shapes)", () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchMock.mockRestore());

  const lastRequest = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as Request;

  it("reads the state", async () => {
    fetchMock.mockImplementation(async () => json(started()));
    await expect(identityService.getState()).resolves.toEqual(started());
    expect(lastRequest().method).toBe("GET");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/identity-verification");
  });

  it("starts a session with the explicit consent and the policy version it showed (capture 203)", async () => {
    fetchMock.mockImplementation(async () => json(session(), 201));
    const result = await identityService.startSession({ consent: true, policyVersion: "kyc-2026-10" });
    expect(result.verification_id).toBe(VERIFICATION_ID);
    expect(result.widget.metadata.oakly_ref).toBe("a0fbe750-b549-4a8a-95ae-512fbe35358c");
    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/identity-verification/sessions");
    expect(await lastRequest().clone().json()).toEqual({ consent: true, policy_version: "kyc-2026-10" });
  });

  it("accepts the 200 that resumes the running attempt, which the generated types leave without a body (capture 204)", async () => {
    fetchMock.mockImplementation(async () => json(session(), 200));
    const result = await identityService.startSession({ consent: true, policyVersion: "kyc-2026-10" });
    expect(result.verification_id).toBe(VERIFICATION_ID);
    expect(result.state.last_attempt_status).toBe("started");
  });

  it("sends a hint to the attempt's own path, with the session id only when there is one (captures 205, 206)", async () => {
    fetchMock.mockImplementation(async () => json(started()));
    await identityService.sendClientEvent(VERIFICATION_ID, "opened");
    expect(lastRequest().url).toBe(
      `http://test.local/api/v1/caregiver/identity-verification/${VERIFICATION_ID}/client-event`,
    );
    expect(await lastRequest().clone().json()).toEqual({ event: "opened" });

    await identityService.sendClientEvent(VERIFICATION_ID, "completed", "placeholder-session-001");
    expect(await lastRequest().clone().json()).toEqual({ event: "completed", session_id: "placeholder-session-001" });
  });

  it("defers with no body", async () => {
    fetchMock.mockImplementation(async () => json(tryAgain()));
    await identityService.defer();
    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/identity-verification/defer");
  });

  it("surfaces the object-shaped error and its code (capture 212) with the server's message", async () => {
    const detail = {
      code: "ATTEMPTS_EXHAUSTED",
      message: "You have used all your identity verification attempts. Our team will review your case.",
    };
    fetchMock.mockImplementation(async () => json({ detail }, 409));
    const error = await identityService.startSession({ consent: true, policyVersion: "kyc-2026-10" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(identityErrorCode(error)).toBe("ATTEMPTS_EXHAUSTED");
    expect(error.message).toBe(detail.message);
  });
});

describe("parseSession: the hosted page url (backend slice KD2)", () => {
  it("carries widget_url through when the server sends it, and leaves it out when it does not", () => {
    expect(parseSession(sessionWithUrl()).widget_url).toBe(WIDGET_URL);
    expect("widget_url" in parseSession(session())).toBe(false);
    expect("widget_url" in parseSession({ ...session(), widget_url: 42 })).toBe(false);
  });
});

describe("parseSession", () => {
  it("refuses a body without what the widget needs instead of opening it half-configured", () => {
    expect(() => parseSession({})).toThrow("Unexpected identity session response");
    expect(() => parseSession({ verification_id: "x", widget: { widget_id: "w" } })).toThrow();
    expect(() => parseSession(null)).toThrow();
  });
});

describe("the service is swappable", () => {
  afterEach(() => setIdentityService(createMockIdentityService()));

  it("delegates to whatever was installed", async () => {
    const getState = jest.fn().mockResolvedValue(tryAgain());
    setIdentityService({ getState, startSession: jest.fn(), sendClientEvent: jest.fn(), defer: jest.fn() });
    await expect(identityService.getState()).resolves.toEqual(tryAgain());
    expect(getState).toHaveBeenCalledTimes(1);
  });
});

describe("mock service plays the server's part", () => {
  const consent = { consent: true, policyVersion: "kyc-2026-10" } as const;

  /** Starts an attempt, reports `completed`, and reads until the simulated partner has answered. */
  async function runAttempt(service: ReturnType<typeof createMockIdentityService>) {
    const created = await service.startSession(consent);
    await service.sendClientEvent(created.verification_id, "opened");
    await service.sendClientEvent(created.verification_id, "completed", "mock-session-001");
    expect(service.peek().last_attempt_status).toBe("awaiting_result");
    return service.getState();
  }

  it("knows its scenarios and defaults to pass", () => {
    expect(parseMockScenario("try_again")).toBe("try_again");
    expect(parseMockScenario("nonsense")).toBe("pass");
    expect(parseMockScenario(undefined)).toBe("pass");
  });

  it("pass: a hint never verifies; only the simulated answer does", async () => {
    const service = createMockIdentityService({ scenario: "pass", pollsToResolve: 2 });
    const created = await service.startSession(consent);
    const afterCompleted = await service.sendClientEvent(created.verification_id, "completed", "x");
    expect(afterCompleted.status).toBe("in_progress");
    expect((await service.getState()).status).toBe("in_progress");
    expect((await service.getState()).status).toBe("verified");
  });

  it("try_again: the first attempt fails with a tip and the next passes", async () => {
    const service = createMockIdentityService({ scenario: "try_again", pollsToResolve: 1 });
    const first = await runAttempt(service);
    expect(first).toMatchObject({ status: "in_progress", last_attempt_status: "failed", failure_hint: "lighting", can_start: true, attempts_used: 1 });
    expect((await runAttempt(service)).status).toBe("verified");
  });

  it("exhausted: every attempt fails until none is left", async () => {
    const service = createMockIdentityService({ scenario: "exhausted", pollsToResolve: 1 });
    for (let i = 0; i < 3; i++) await runAttempt(service);
    expect(service.peek()).toMatchObject({ attempts_used: 3, can_start: false, last_attempt_status: "failed" });
    const error = await service.startSession(consent).catch((e) => e);
    expect(identityErrorCode(error)).toBe("ATTEMPTS_EXHAUSTED");
  });

  it("needs_review: the case goes to a person with the review time, and no more starts", async () => {
    const service = createMockIdentityService({ scenario: "needs_review", pollsToResolve: 1 });
    expect(await runAttempt(service)).toMatchObject({ status: "needs_review", review_eta_hours: 24, can_start: false });
    expect(identityErrorCode(await service.startSession(consent).catch((e) => e))).toBe("UNDER_REVIEW");
  });

  it("expired and error do not use up an attempt", async () => {
    for (const scenario of ["expired", "error"] as const) {
      const service = createMockIdentityService({ scenario, pollsToResolve: 1 });
      expect(await runAttempt(service)).toMatchObject({ last_attempt_status: scenario, attempts_used: 0, can_start: true });
    }
  });

  it("provider_down: no session (503) and 'continue without' is allowed; otherwise defer is refused", async () => {
    const down = createMockIdentityService({ scenario: "provider_down" });
    expect(identityErrorCode(await down.startSession(consent).catch((e) => e))).toBe("PROVIDER_UNAVAILABLE");
    await expect(down.defer()).resolves.toMatchObject({ provider_available: false });
    const up = createMockIdentityService({ scenario: "pass" });
    expect(identityErrorCode(await up.defer().catch((e) => e))).toBe("PROVIDER_AVAILABLE");
  });

  it("rejected: a person already turned the identity down", async () => {
    const service = createMockIdentityService({ scenario: "rejected" });
    expect((await service.getState()).status).toBe("failed");
    expect(identityErrorCode(await service.startSession(consent).catch((e) => e))).toBe("IDENTITY_REJECTED");
  });

  it("refuses a stale consent text version and someone else's attempt", async () => {
    const service = createMockIdentityService();
    expect(identityErrorCode(await service.startSession({ consent: true, policyVersion: "old" }).catch((e) => e))).toBe(
      "POLICY_VERSION_MISMATCH",
    );
    expect(identityErrorCode(await service.sendClientEvent("not-mine", "opened").catch((e) => e))).toBe("VERIFICATION_NOT_FOUND");
  });

  it("returns the running attempt again instead of using another one", async () => {
    const service = createMockIdentityService();
    const first = await service.startSession(consent);
    const again = await service.startSession(consent);
    expect(again.verification_id).toBe(first.verification_id);
    expect(again.state.attempts_used).toBe(1);
  });
});
