import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";
import { KYC_MODE } from "@/src/identity/config";
import type {
  IdentityClientEvent,
  IdentitySession,
  IdentityState,
  IdentityWidgetConfig,
} from "@/src/identity/identityModel";
import { createMockIdentityService, defaultMockScenario } from "@/src/identity/mockIdentityService";

/**
 * The caregiver identity endpoints (backend K2, guide section 4). Everything the screens use goes through this
 * interface, so the mock and the real service are interchangeable and the provider never shows in an app type.
 */
export interface IdentityVerificationService {
  /** GET /caregiver/identity-verification. Also what the app polls. */
  getState(): Promise<IdentityState>;
  /** POST .../sessions: records the separate consent, opens or resumes the attempt, returns the widget config. */
  startSession(input: { consent: true; policyVersion: string }): Promise<IdentitySession>;
  /** POST .../{id}/client-event: a hint from the widget. It never changes the identity status. */
  sendClientEvent(verificationId: string, event: IdentityClientEvent): Promise<IdentityState>;
  /** POST .../defer: "Continue without for now"; only while verification is unavailable. */
  defer(): Promise<IdentityState>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * `POST .../sessions` answers `201` the first time and `200` when it resumes the running attempt, with the same body
 * (guide capture 204). The generated schema types only the `201`, so the body is narrowed here at the boundary
 * (same approach as `parseVerificationStatus`). Throws when the server's answer lacks what the widget needs.
 */
export function parseSession(raw: unknown): IdentitySession {
  const body = asRecord(raw);
  const widget = asRecord(body.widget);
  const verificationId = text(body.verification_id);
  const widgetUrl = text(body.widget_url);
  if (!verificationId || !widgetUrl || !text(widget.reference_id)) {
    throw new Error("Unexpected identity session response");
  }
  const config: IdentityWidgetConfig = {
    app_id: text(widget.app_id),
    public_key: text(widget.public_key),
    widget_id: text(widget.widget_id),
    reference_id: text(widget.reference_id),
    email: text(widget.email),
    first_name: text(widget.first_name),
    last_name: text(widget.last_name),
    ...(typeof widget.date_of_birth === "string" ? { date_of_birth: widget.date_of_birth } : {}),
  };
  return {
    verification_id: verificationId,
    attempt_no: typeof body.attempt_no === "number" ? body.attempt_no : 1,
    widget: config,
    state: body.state as IdentityState,
    widget_url: widgetUrl,
  };
}

const apiIdentityService: IdentityVerificationService = {
  getState() {
    return unwrap(api.GET("/api/v1/caregiver/identity-verification"));
  },

  async startSession({ consent, policyVersion }) {
    return parseSession(
      await unwrap(
        api.POST("/api/v1/caregiver/identity-verification/sessions", {
          body: { consent, policy_version: policyVersion },
        }),
      ),
    );
  },

  sendClientEvent(verificationId, event) {
    return unwrap(
      api.POST("/api/v1/caregiver/identity-verification/{verification_id}/client-event", {
        params: { path: { verification_id: verificationId } },
        body: { event },
      }),
    );
  },

  defer() {
    return unwrap(api.POST("/api/v1/caregiver/identity-verification/defer"));
  },
};

let active: IdentityVerificationService =
  KYC_MODE === "mock" ? createMockIdentityService({ scenario: defaultMockScenario }) : apiIdentityService;

/** Swap the implementation (dev tooling, tests). */
export function setIdentityService(next: IdentityVerificationService): void {
  active = next;
}

/** What the app imports. Delegates to the active implementation, so `jest.spyOn(identityService, ...)` works. */
export const identityService: IdentityVerificationService = {
  getState: () => active.getState(),
  startSession: (input) => active.startSession(input),
  sendClientEvent: (id, event) => active.sendClientEvent(id, event),
  defer: () => active.defer(),
};
