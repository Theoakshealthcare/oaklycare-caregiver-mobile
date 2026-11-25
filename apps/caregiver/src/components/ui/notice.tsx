import type React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/** A calm one-line banner: a closed window ("Notes for this visit are closed."), or when one closes. Not an error, so no red. */
const Notice: React.FC<{ message: string; testID?: string; style?: StyleProp<ViewStyle> }> = ({ message, testID, style }) => (
  <View
    testID={testID}
    accessibilityRole="alert"
    style={[{ backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md }, style]}
  >
    <Text variant="small" color={theme.colors.text}>
      {message}
    </Text>
  </View>
);

export default Notice;
