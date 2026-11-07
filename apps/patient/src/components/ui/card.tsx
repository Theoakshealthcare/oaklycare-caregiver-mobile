import type React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "@/src/constants/theme";

import Text from "./text";

interface CardProps {
  children: React.ReactNode;
  /** `tint` is the light-teal card used for tiles and summaries. */
  tone?: "plain" | "tint" | "warm";
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Rounded card; pressable when it has an `onPress`. */
export const Card: React.FC<CardProps> = ({ children, tone = "plain", onPress, accessibilityLabel, style }) => {
  const cardStyle = [styles.card, tone === "tint" && styles.tint, tone === "warm" && styles.warm, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={cardStyle}>
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

type ChipTone = "primary" | "success" | "warning" | "error" | "neutral";

const chipColors: Record<ChipTone, { bg: string; fg: string }> = {
  primary: { bg: theme.colors.primaryLight, fg: theme.colors.primary },
  success: { bg: theme.colors.successLight, fg: theme.colors.success },
  warning: { bg: theme.colors.warningLight, fg: theme.colors.warningText },
  error: { bg: theme.colors.errorLight, fg: theme.colors.error },
  neutral: { bg: theme.colors.background, fg: theme.colors.textLight },
};

/** A small status pill ("PAID", "Critical", "Canceled"). */
export const Chip: React.FC<{ label: string; tone?: ChipTone }> = ({ label, tone = "primary" }) => (
  <View style={[styles.chip, { backgroundColor: chipColors[tone].bg }]}>
    <Text variant="small" weight="bold" color={chipColors[tone].fg}>
      {label}
    </Text>
  </View>
);

/** A label and a value on one line (booking details, summaries). */
export const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text variant="small" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="small" weight="medium" style={styles.detailValue}>
      {value}
    </Text>
  </View>
);

/** A card-sized notice ("Nothing here yet"). */
export const EmptyState: React.FC<{ title: string; message?: string }> = ({ title, message }) => (
  <View style={styles.empty}>
    <Text weight="bold" center>
      {title}
    </Text>
    {message ? (
      <Text variant="small" color={theme.colors.textLight} center>
        {message}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xxl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tint: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  warm: { backgroundColor: theme.colors.secondaryLight, borderColor: theme.colors.secondaryLight },
  chip: {
    alignSelf: "flex-start",
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  detailValue: { flexShrink: 1, textAlign: "right" },
  empty: { alignItems: "center", gap: theme.spacing.xs, paddingVertical: theme.spacing.xl },
});
