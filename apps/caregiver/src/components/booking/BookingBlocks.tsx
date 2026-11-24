import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/** The pieces of a Bookings card, drawn as in the Figma export (8.18.01 and 8.18.14). */

type IconName = React.ComponentProps<typeof Feather>["name"];

/** The round-cornered picture square: the patient's initial after acceptance (the response carries no photo), a plain icon before. */
export const BookingAvatar: React.FC<{ initial?: string }> = ({ initial }) => (
  <View style={styles.avatar}>
    {initial ? (
      <Text variant="h3" weight="bold" color={theme.colors.primary}>
        {initial}
      </Text>
    ) : (
      <Feather name="user" size={24} color={theme.colors.primary} />
    )}
  </View>
);

/** The small mint chip (service) or grey chip (status) beside the name. */
export const BookingChip: React.FC<{ label: string; tone?: "service" | "status"; testID?: string }> = ({ label, tone = "service", testID }) => (
  <View style={[styles.chip, tone === "service" ? styles.chipService : styles.chipStatus]} testID={testID}>
    <Text variant="micro" weight="medium" color={theme.colors.primary} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** An icon and one line: the address (calendar icon) and the time (clock icon) of a card. */
export const BookingLine: React.FC<{ icon: IconName; text: string; testID?: string }> = ({ icon, text, testID }) => (
  <View style={styles.line}>
    <Feather name={icon} size={13} color={theme.colors.primary} />
    <View style={{ flex: 1 }}>
      <Text variant="label" color={theme.colors.muted} testID={testID}>
        {text}
      </Text>
    </View>
  </View>
);

/** The little rounded buttons under a card: solid teal ("View Details", "Accept", "Start Service") or coral ("Decline"). */
export const ActionChip: React.FC<{
  label: string;
  icon?: IconName;
  tone?: "teal" | "coral";
  onPress: () => void;
  disabled?: boolean;
}> = ({ label, icon, tone = "teal", onPress, disabled = false }) => {
  const coral = tone === "coral";
  const color = coral ? theme.colors.secondary : theme.colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, { backgroundColor: coral ? theme.colors.secondaryLight : theme.colors.primary }, disabled && styles.dim]}
    >
      {icon ? <Feather name={icon} size={11} color={color} /> : null}
      <Text variant="micro" weight="medium" color={color}>
        {label}
      </Text>
    </Pressable>
  );
};

/** The card: avatar, then a column with the name row, the chips, the lines and the buttons. */
export const BookingCardFrame: React.FC<{
  avatar: React.ReactNode;
  name: string;
  /** Top-right grey chip (the booking's status). */
  status?: string;
  /** The mint service chip under the name. */
  service?: string | null;
  lines: React.ReactNode;
  /** "N250,000 (90 min session)": only when the booking carries the caregiver's own figure. */
  price?: string | null;
  actions: React.ReactNode;
  onOpen?: () => void;
  testID?: string;
}> = ({ avatar, name, status, service, lines, price, actions, onOpen, testID }) => (
  <View style={styles.card} testID={testID}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={onOpen} disabled={!onOpen} style={styles.top}>
      {avatar}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="bold" color="#000000" numberOfLines={1}>
              {name}
            </Text>
          </View>
          {status ? <BookingChip label={status} tone="status" testID="booking-status" /> : null}
        </View>
        {service ? (
          <View style={{ alignSelf: "flex-start" }}>
            <BookingChip label={service} />
          </View>
        ) : null}
        {lines}
        {price ? (
          <Text variant="label" color={theme.colors.muted} testID="booking-price">
            {price}
          </Text>
        ) : null}
      </View>
    </Pressable>
    <View style={styles.actions}>{actions}</View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.small,
  },
  top: { flexDirection: "row", gap: theme.spacing.md },
  body: { flex: 1, gap: theme.spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: { paddingVertical: 2, paddingHorizontal: theme.spacing.sm, borderRadius: theme.borderRadius.round },
  chipService: { backgroundColor: `${theme.colors.primary}26` },
  chipStatus: { backgroundColor: theme.colors.soft },
  line: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: theme.spacing.sm, paddingLeft: 72 + theme.spacing.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: theme.borderRadius.round,
  },
  dim: { opacity: 0.4 },
});
