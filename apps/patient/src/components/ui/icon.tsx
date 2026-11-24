import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "../../constants/theme";

/** An Ionicons name, or "wind" (Ionicons has none; drawn with the Material Community "weather-windy" glyph). */
export type IconName = keyof typeof Ionicons.glyphMap | "wind";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Draws the icon on a filled circle of this colour. */
  circleColor?: string;
  style?: StyleProp<ViewStyle>;
}

const Glyph: React.FC<{ name: IconName; size: number; color: string; style?: StyleProp<ViewStyle> }> = ({ name, size, color, style }) =>
  name === "wind" ? (
    <MaterialCommunityIcons name="weather-windy" size={size} color={color} style={style as never} />
  ) : (
    <Ionicons name={name} size={size} color={color} style={style as never} />
  );

const Icon: React.FC<IconProps> = ({ name, size = 24, color = theme.colors.text, circleColor, style }) => {
  if (!circleColor) return <Glyph name={name} size={size} color={color} style={style} />;
  const diameter = Math.round(size * 1.8);
  return (
    <View
      style={[
        { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: circleColor },
        { alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <Glyph name={name} size={size} color={color} />
    </View>
  );
};

export default Icon;
