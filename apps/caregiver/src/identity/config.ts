/**
 * Whether the identity (KYC) step is part of onboarding, and which service backs it.
 *
 *   off  (default)  the step does not exist: Step 2 goes straight to Consent, as before K7a.
 *   mock            an in-memory service and a simulated widget, for building and demoing the screens.
 *   api             the real caregiver endpoints. Until slice K7b brings a widget there is nothing that can
 *                   finish an attempt, so a release build must not turn this on before K7b ships.
 *
 * Default `off` on purpose: with no widget, a caregiver sent to this step could never pass it, and an
 * outage-style lockout is exactly what the design (anti-goals, section 1) forbids.
 */
export type KycMode = "off" | "mock" | "api";

export function parseKycMode(raw: string | undefined): KycMode {
  return raw === "mock" || raw === "api" ? raw : "off";
}

// `process.env.EXPO_PUBLIC_*` must be read by name for Expo to inline it at build time.
export const KYC_MODE: KycMode = parseKycMode(process.env.EXPO_PUBLIC_KYC_MODE);

export const kycEnabled = (mode: KycMode = KYC_MODE): boolean => mode !== "off";

/** Dev-only: which simulated outcome the mock service plays (see `mockIdentityService.ts`). */
export const KYC_MOCK_SCENARIO: string | undefined = process.env.EXPO_PUBLIC_KYC_MOCK_SCENARIO;
