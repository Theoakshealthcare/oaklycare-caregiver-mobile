import React from "react";
import { View } from "react-native";

/**
 * The colourful orb of the AI Notetaker frame ("I'm Listening"). Drawn with plain views (the app has no gradient or SVG
 * library): a disc with soft overlapping blobs of blue, violet, coral and amber, clipped to the circle. Decorative only.
 */
const BLOBS = [
  { color: "#3F8EFC", x: -0.1, y: -0.05, size: 0.7, opacity: 0.95 },
  { color: "#9B5DE5", x: 0.35, y: 0.0, size: 0.6, opacity: 0.9 },
  { color: "#F15BB5", x: 0.15, y: 0.3, size: 0.55, opacity: 0.85 },
  { color: "#FF7B54", x: 0.45, y: 0.4, size: 0.55, opacity: 0.85 },
  { color: "#FEE440", x: 0.05, y: 0.6, size: 0.6, opacity: 0.9 },
  { color: "#00BBF9", x: 0.5, y: 0.1, size: 0.4, opacity: 0.6 },
] as const;

const AiOrb: React.FC<{ size?: number; testID?: string }> = ({ size = 76, testID }) => (
  <View
    testID={testID}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: "hidden",
      backgroundColor: "#7AA7F7",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    }}
  >
    {BLOBS.map((blob) => (
      <View
        key={blob.color}
        style={{
          position: "absolute",
          left: blob.x * size,
          top: blob.y * size,
          width: blob.size * size,
          height: blob.size * size,
          borderRadius: (blob.size * size) / 2,
          backgroundColor: blob.color,
          opacity: blob.opacity,
        }}
      />
    ))}
  </View>
);

export default AiOrb;
