import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Icon, { type IconName } from "./icon";
import Text from "./text";

interface MenuRowProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Coral label for log out / delete. */
  destructive?: boolean;
}

/** One tappable row of a settings list: icon, label, chevron. */
const MenuRow: React.FC<MenuRowProps> = ({ icon, label, onPress, destructive }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
    <Icon name={icon} size={20} color={destructive ? theme.colors.secondary : theme.colors.primary} circleColor={destructive ? theme.colors.errorLight : theme.colors.primaryLight} />
    <View style={styles.label}>
      <Text weight="medium" color={destructive ? theme.colors.secondary : theme.colors.text}>
        {label}
      </Text>
    </View>
    <Icon name="chevron-forward" size={18} color={theme.colors.textLight} />
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  label: { flex: 1 },
});

export default MenuRow;
