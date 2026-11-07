import type React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Text from "./text";

interface ChipSelectProps {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** A labelled row of pill choices that scrolls sideways (date and time pickers without a native module). */
const ChipSelect: React.FC<ChipSelectProps> = ({ label, options, value, onChange, error }) => (
  <View style={styles.wrap}>
    <Text variant="small">{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.selected]}
          >
            <Text variant="small" weight="bold" color={selected ? theme.colors.white : theme.colors.text}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
    {error ? (
      <Text variant="small" color={theme.colors.secondary}>
        {error}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.xs },
  row: { gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  chip: {
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
});

export default ChipSelect;
