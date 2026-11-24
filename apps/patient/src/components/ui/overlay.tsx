import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useDimBands } from "@/src/components/StatusBar/screenChrome";
import { theme } from "@/src/constants/theme";

const DIM = "rgba(0,0,0,0.5)";

interface OverlayProps {
  /** `bottom`: a sheet resting on the bottom edge. `center`: a dialog in the middle (Figma). */
  align: "bottom" | "center";
  /** Tapping the dimmed area behind the card. */
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The body of a screen that is drawn over the one before it (the booking details sheet, the cancel dialogs): a dimmed
 * backdrop and a white card. The route using it is registered as a transparent modal, so the page behind stays visible.
 */
const Overlay: React.FC<OverlayProps> = ({ align, onClose, children }) => {
  useDimBands(DIM);
  return (
  <View style={[styles.root, align === "bottom" ? styles.bottom : styles.center]}>
    <Pressable accessibilityLabel="Close" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} />
    <View style={[styles.card, align === "bottom" ? styles.sheet : styles.dialog]}>{children}</View>
  </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DIM },
  bottom: { justifyContent: "flex-end", padding: theme.spacing.md },
  // Figma: the dialog card is about 81% of the screen wide.
  center: { justifyContent: "center", paddingHorizontal: "9.5%", paddingVertical: theme.spacing.lg },
  card: { backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xxl + 8 },
  sheet: { maxHeight: "88%", paddingBottom: theme.spacing.md },
  dialog: { padding: theme.spacing.lg, gap: theme.spacing.md, alignItems: "stretch" },
});

export default Overlay;
