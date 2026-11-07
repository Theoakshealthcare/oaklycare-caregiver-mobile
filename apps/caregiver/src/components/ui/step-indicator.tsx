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

/** "Step 2 of 4" and a bar that fills a quarter per step (DP1-09). */
const StepIndicator: React.FC<{ step: number; total?: number }> = ({ step, total = onboardingStepCount() }) => (
  <View style={{ marginTop: 20 }}>
    <Text variant="body" weight="medium" testID="step-label">
      {`Step ${step} of ${total}`}
    </Text>
    <View style={{ height: 4, backgroundColor: theme.colors.border, borderRadius: 2, marginTop: 8 }}>
      <View
        testID="step-bar"
        style={{ height: 4, backgroundColor: theme.colors.primary, borderRadius: 2, width: `${Math.round((step / total) * 100)}%` }}
      />
    </View>
  </View>
);

export default StepIndicator;
