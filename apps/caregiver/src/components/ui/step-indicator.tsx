import React from "react";
import { View } from "react-native";

import { theme } from "@/src/constants/theme";
import { kycEnabled } from "@/src/identity/config";

import Text from "./text";

/** Profile, Work & Experience, Identity (only while the identity check is on), Consent. */
export function onboardingStepCount(identityStep: boolean = kycEnabled()): number {
  return identityStep ? 4 : 3;
}

/** Which step the screens are: Consent is always the last one. */
export const ONBOARDING_STEP = { profile: 1, work: 2, identity: 3 } as const;
export function consentStepNumber(identityStep: boolean = kycEnabled()): number {
  return onboardingStepCount(identityStep);
}

/**
 * "Step 2" in small grey type over a thin track with a teal fill that grows by one step each time (Figma). The total only sets
 * the fill: four steps with the identity check on (a quarter each), three without.
 */
const StepIndicator: React.FC<{ step: number; total?: number }> = ({ step, total = onboardingStepCount() }) => (
  <View style={{ marginTop: 16 }}>
    <Text variant="caption" color={theme.colors.textLight} testID="step-label">
      {`Step ${step}`}
    </Text>
    <View style={{ height: 2, backgroundColor: theme.colors.border, marginTop: 8 }}>
      <View
        testID="step-bar"
        style={{ height: 2, backgroundColor: theme.colors.primary, width: `${Math.round((step / total) * 100)}%` }}
      />
    </View>
  </View>
);

export default StepIndicator;
