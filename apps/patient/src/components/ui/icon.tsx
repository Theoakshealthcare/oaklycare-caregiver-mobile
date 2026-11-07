import { Ionicons } from "@expo/vector-icons";
import type React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "../../constants/theme";

export type IconName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Draws the icon on a filled circle of this colour. */
  circleColor?: string;
  style?: StyleProp<ViewStyle>;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, color = theme.colors.text, circleColor, style }) => {
  if (!circleColor) return <Ionicons name={name} size={size} color={color} style={style as never} />;
  const diameter = Math.round(size * 1.8);
  return (
    <View
      style={[
        { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: circleColor },
        { alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
};

export default Icon;
