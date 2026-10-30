/**
 * Whether the identity (KYC) step is part of onboarding, and which service backs it.
 *
 *   off  (default)  the step does not exist: Step 2 goes straight to Consent, as before K7a.
 *   mock            an in-memory service and a simulated widget, for building and demoing the screens.
 *   api             the real caregiver endpoints, and the verification page the backend hosts, opened in the
 *                   system browser session (K7b). Needs a dev/production build that contains `expo-web-browser`,
 *                   and a backend with `widget_url` on the session response (slice KD2) whose `KYC_RETURN_URL`
 *                   setting equals the `KYC_RETURN_URL` constant below.
 *
 * Default `off` on purpose: this flow has not been run on a device, and a caregiver sent to a step they cannot
 * pass is exactly the lockout the design (anti-goals, section 1) forbids. Turn it on with
 * `EXPO_PUBLIC_KYC_MODE=api` at build time (it is inlined by Expo, so rebuild or restart Metro with `--clear`).
 */
export type KycMode = "off" | "mock" | "api";

export function parseKycMode(raw: string | undefined): KycMode {
  return raw === "mock" || raw === "api" ? raw : "off";
}

// `process.env.EXPO_PUBLIC_*` must be read by name for Expo to inline it at build time.
export const KYC_MODE: KycMode = parseKycMode(process.env.EXPO_PUBLIC_KYC_MODE);

export const kycEnabled = (mode: KycMode = KYC_MODE): boolean => mode !== "off";

/**
 * Where the hosted page sends the person back to the app when it ends (success, close or error alike: the page does not
 * report the outcome). Must equal the backend setting `KYC_RETURN_URL`. The scheme is `expo.scheme` in `app.json`.
 */
export const KYC_RETURN_URL = "oaklycarecaregivermobile://kyc/return";

/** Dev-only: which simulated outcome the mock service plays (see `mockIdentityService.ts`). */
export const KYC_MOCK_SCENARIO: string | undefined = process.env.EXPO_PUBLIC_KYC_MOCK_SCENARIO;
