import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { theme } from "@/src/constants/theme";

/**
 * The green check illustration on the "account created" and "profile setup completed" frames: a solid check disc over two
 * soft diagonal bars, with a few small dots around it. Drawn with plain views so it needs no image asset and stays sharp.
 */
const SIZE = 220;
const DISC = 112;

const bar = (style: object) => ({
  position: "absolute" as const,
  backgroundColor: theme.colors.successLight,
  borderRadius: 24,
  transform: [{ rotate: "-30deg" }],
  ...style,
});

const dot = (style: object) => ({
  position: "absolute" as const,
  borderRadius: 9999,
  ...style,
});

const SuccessIllustration: React.FC = () => (
  <View testID="success-illustration" style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
    <View style={bar({ width: 150, height: 44, top: 56, left: 14 })} />
    <View style={bar({ width: 110, height: 40, top: 110, left: 60 })} />
    <View style={bar({ width: 40, height: 28, top: 44, right: 10 })} />
    <View style={dot({ width: 44, height: 44, bottom: 40, right: 8, backgroundColor: theme.colors.successLight })} />
    <View style={dot({ width: 10, height: 10, top: 20, left: 70, borderWidth: 2, borderColor: theme.colors.success })} />
    <View style={dot({ width: 10, height: 10, bottom: 30, left: 62, borderWidth: 2, borderColor: theme.colors.success })} />
    <View style={dot({ width: 6, height: 6, top: 70, left: 8, backgroundColor: theme.colors.success })} />
    <View
      style={{
        width: DISC,
        height: DISC,
        borderRadius: DISC / 2,
        backgroundColor: theme.colors.success,
        borderWidth: 4,
        borderColor: theme.colors.successLight,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name="check" size={64} color={theme.colors.white} />
    </View>
  </View>
);

export default SuccessIllustration;
