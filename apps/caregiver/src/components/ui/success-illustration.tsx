import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";

/**
 * The green check illustration on the "account created" and "profile setup completed" frames: a check disc over three
 * diagonal mint bars, with a mint bubble and a few small rings and crosses (drawn with plain views, so it needs no image
 * asset and stays sharp). Positions are the Figma frame's, in points. The colours are the Figma pixels converted from
 * Display P3 to sRGB (the exports are P3).
 */
const WIDTH = 214;
const HEIGHT = 180;
const ORIGIN = { x: 190, y: 45 };
/** Crop pixels of the reference frame -> points. */
const U = 1 / 2.208;

const DISC_GREEN = "#26AD61";
const RING_GREEN = "#6FCF97";
const BAR_MINT = "#B7E7CB";
const BUBBLE_MINT = "#CCFFF0";
const LINE_GREEN = "#78D29E";

const at = (x: number, y: number) => ({ x: (x - ORIGIN.x) * U, y: (y - ORIGIN.y) * U });

/** A rounded bar rising to the right at 30 degrees, from its centre point and overall length/thickness (frame pixels). */
const bar = (cx: number, cy: number, length: number, thickness: number) => {
  const c = at(cx, cy);
  const w = length * U;
  const h = thickness * U;
  return {
    position: "absolute" as const,
    left: c.x - w / 2,
    top: c.y - h / 2,
    width: w,
    height: h,
    borderRadius: h / 2,
    backgroundColor: BAR_MINT,
    transform: [{ rotate: "-30deg" }],
  };
};

const ring = (cx: number, cy: number, r: number, filled = false) => {
  const c = at(cx, cy);
  const d = r * 2 * U;
  return {
    position: "absolute" as const,
    left: c.x - d / 2,
    top: c.y - d / 2,
    width: d,
    height: d,
    borderRadius: d / 2,
    borderWidth: filled ? 0 : 2,
    borderColor: LINE_GREEN,
    backgroundColor: filled ? LINE_GREEN : "transparent",
  };
};

const cross = (cx: number, cy: number) => {
  const c = at(cx, cy);
  return { position: "absolute" as const, left: c.x - 4, top: c.y - 4 };
};

const SuccessIllustration: React.FC = () => {
  const disc = at(413, 240);
  const outer = 234 * U;
  const inner = 210 * U;
  return (
    <View testID="success-illustration" style={{ width: WIDTH, height: HEIGHT }}>
      <View style={bar(351, 170, 342, 62)} />
      <View style={bar(407, 261, 339, 62)} />
      <View style={bar(464, 351, 275, 62)} />
      <View style={bar(601, 150, 96, 56)} />
      <View
        style={{
          position: "absolute",
          left: at(636, 328).x - 50 * U,
          top: at(636, 328).y - 50 * U,
          width: 100 * U,
          height: 100 * U,
          borderRadius: 50 * U,
          backgroundColor: BUBBLE_MINT,
        }}
      />
      <View style={ring(409, 64, 10)} />
      <View style={ring(285, 428, 10)} />
      <View style={ring(600, 314, 6)} />
      <View style={ring(520, 439, 5)} />
      <View style={ring(205, 175, 5)} />
      <Feather name="x" size={8} color={LINE_GREEN} style={cross(569, 46)} />
      <Feather name="x" size={8} color={LINE_GREEN} style={cross(224, 312)} />
      <Feather name="x" size={8} color={LINE_GREEN} style={cross(561, 382)} />
      <View
        style={{
          position: "absolute",
          left: disc.x - outer / 2,
          top: disc.y - outer / 2,
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          backgroundColor: RING_GREEN,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: DISC_GREEN,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="check" size={56} color="#FFFFFF" />
        </View>
      </View>
    </View>
  );
};

export default SuccessIllustration;
