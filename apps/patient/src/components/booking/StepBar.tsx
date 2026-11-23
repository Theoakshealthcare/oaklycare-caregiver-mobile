import type React from "react";
import { View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/** "Step 1" in small grey type over a thin track with a teal fill that grows with the step (Figma). */
const StepBar: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <View>
    <Text variant="fine" color={theme.colors.textLight}>
      {`Step ${step}`}
    </Text>
    <View style={{ height: 3, backgroundColor: "#F0F0F0", marginTop: theme.spacing.sm }}>
      <View testID="step-bar" style={{ height: 3, backgroundColor: theme.colors.primary, width: `${Math.round((step / total) * 100)}%` }} />
    </View>
  </View>
);

export default StepBar;
