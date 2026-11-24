import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Icon, { type IconName } from "./icon";
import Text from "./text";

interface MenuRowProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Coral icon and label (Logout). */
  destructive?: boolean;
  /** Coral icon only, the label stays dark (Delete Account in the design). */
  dangerIcon?: boolean;
  /** Show the ">" at the end (default). Logout in the design has none. */
  chevron?: boolean;
  /** No line under the row. */
  last?: boolean;
}

/** One tappable row of a settings list: icon, label, chevron. */
const MenuRow: React.FC<MenuRowProps> = ({ icon, label, onPress, destructive, dangerIcon, chevron = true, last }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.row, last && styles.last]}>
    {/* The design draws a bare icon, not one on a disc. */}
    <Icon name={icon} size={22} color={destructive || dangerIcon ? theme.colors.secondary : theme.colors.primary} />
    <View style={styles.label}>
      <Text weight="medium" color={destructive ? theme.colors.secondary : theme.colors.text}>
        {label}
      </Text>
    </View>
    {chevron ? <Icon name="chevron-forward" size={18} color={theme.colors.text} /> : null}
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  last: { borderBottomWidth: 0 },
  label: { flex: 1 },
});

export default MenuRow;
