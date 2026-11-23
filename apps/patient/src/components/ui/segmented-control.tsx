import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Text from "./text";

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** `onTeal`: a white track with a teal pill and white text for the selected option (the Bookings header; Figma). */
  tone?: "default" | "onTeal";
}

/** A pill toggle (Upcoming / Completed / Canceled, Day / Week / Month). */
function SegmentedControl<T extends string>({ options, value, onChange, tone = "default" }: SegmentedControlProps<T>) {
  const onTeal = tone === "onTeal";
  return (
    <View style={[styles.track, onTeal && styles.trackOnTeal]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && (onTeal ? styles.selectedOnTeal : styles.selected)]}
          >
            <Text variant="small" weight="bold" color={selected ? (onTeal ? theme.colors.white : theme.colors.primary) : theme.colors.textLight}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.round,
    padding: theme.spacing.xs,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.round },
  selected: { backgroundColor: theme.colors.white },
  trackOnTeal: { backgroundColor: theme.colors.white },
  selectedOnTeal: { backgroundColor: theme.colors.primary },
});

export default SegmentedControl;
