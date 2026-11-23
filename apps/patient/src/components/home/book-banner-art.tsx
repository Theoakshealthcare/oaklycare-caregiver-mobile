import type React from "react";
import { View } from "react-native";

import { theme } from "@/src/constants/theme";

/**
 * The leaf artwork on the "Book a Service" banner (Figma): a teal blob and two coral petals in the top-right corner and
 * another pair at the bottom-left, drawn with plain views so no image asset is needed. The banner clips what overflows.
 * Positions are points from the banner's own corner (read from the Figma frame).
 */
const CORAL = theme.colors.secondary;
const TEAL = theme.colors.primary;

/** One half of the heart: round on three corners, pointed at the bottom corner next to the other half. */
const petal = (left: number, top: number, side: "left" | "right") => ({
  position: "absolute" as const,
  left,
  top,
  width: 27,
  height: 37,
  borderRadius: 14,
  ...(side === "left" ? { borderBottomRightRadius: 2 } : { borderBottomLeftRadius: 2 }),
  backgroundColor: CORAL,
  transform: [{ rotate: side === "left" ? "6deg" : "-6deg" }],
});

const blob = (left: number, top: number, size: number) => ({
  position: "absolute" as const,
  left,
  top,
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: TEAL,
});

interface Props {
  /** Banner width in points; the top-right group is placed from the right edge. */
  width: number;
}

const BookBannerArt: React.FC<Props> = ({ width }) => {
  const right = width - 334; // the Figma banner is 334 pt wide
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      <View style={blob(272 + right, -9, 38)} />
      <View style={petal(290 + right, 5, "left")} />
      <View style={petal(317 + right, 6, "right")} />
      <View style={blob(-8, 118, 24)} />
      <View style={blob(46, 118, 30)} />
      <View style={petal(5, 102, "left")} />
      <View style={petal(31, 102, "right")} />
    </View>
  );
};

export default BookBannerArt;
