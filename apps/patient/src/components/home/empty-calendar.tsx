import { Ionicons } from "@expo/vector-icons";
import type React from "react";
import { View } from "react-native";

import { theme } from "@/src/constants/theme";

const SOFT = "#F9C5C0";

/** The red calendar with an x on the empty "no appointments" card (Figma), drawn with views. 44 x 44 points. */
const EmptyCalendar: React.FC = () => (
  <View testID="empty-calendar" style={{ width: 44, height: 44 }}>
    <View style={{ position: "absolute", left: 3, top: 5, width: 34, height: 34, borderRadius: 7, backgroundColor: SOFT }} />
    <View style={{ position: "absolute", left: 3, top: 5, width: 34, height: 11, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: theme.colors.secondary }} />
    <View style={{ position: "absolute", left: 11, top: 1, width: 4, height: 8, borderRadius: 2, backgroundColor: theme.colors.secondary }} />
    <View style={{ position: "absolute", left: 26, top: 1, width: 4, height: 8, borderRadius: 2, backgroundColor: theme.colors.secondary }} />
    {[
      [11, 21],
      [19, 21],
      [11, 29],
    ].map(([left, top]) => (
      <View key={`${left}-${top}`} style={{ position: "absolute", left, top, width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.secondary }} />
    ))}
    <View
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: theme.colors.secondary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="close" size={13} color={theme.colors.white} />
    </View>
  </View>
);

export default EmptyCalendar;
