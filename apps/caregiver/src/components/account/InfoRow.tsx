import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

export type InfoRowTone = "info" | "warning";

/**
 * Icon + message in a tinted card. `Text` wraps its RNText in a bare View, so a `flex: 1` passed as the
 * Text style never reaches the layout node that sits next to the icon; the wrapper here carries the
 * shrink (`flex: 1`, `minWidth: 0`) so long copy wraps inside the card's padding instead of running past it.
 */
const InfoRow: React.FC<{
  tone?: InfoRowTone;
  icon?: React.ComponentProps<typeof Feather>["name"];
  testID?: string;
  textTestID?: string;
  style?: { marginTop?: number; marginBottom?: number; marginVertical?: number };
  children: string;
}> = ({ tone = "info", icon, testID, textTestID, style, children }) => {
  const warning = tone === "warning";
  const color = warning ? theme.colors.warningText : theme.colors.textLight;
  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: "row",
          gap: 10,
          padding: 14,
          borderRadius: 12,
          backgroundColor: warning ? theme.colors.warning + "33" : theme.colors.soft,
        },
        style,
      ]}
    >
      <Feather name={icon ?? (warning ? "alert-triangle" : "info")} size={18} color={warning ? theme.colors.warningText : theme.colors.primary} />
      <View testID={testID ? `${testID}-body` : undefined} style={{ flex: 1, minWidth: 0 }}>
        <Text variant="small" color={color} testID={textTestID}>
          {children}
        </Text>
      </View>
    </View>
  );
};

export default InfoRow;
