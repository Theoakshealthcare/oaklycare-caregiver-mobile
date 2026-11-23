import React, { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { monthName } from "@/src/wallet/walletModel";

/**
 * The outlined month chip with a calendar icon beside "Earning Payment" ("April"). Tapping it lists the months to pick from.
 * The chip says the month only; the list says month and year, so two Novembers cannot be mistaken.
 */
const MonthChip: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose month"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: theme.borderRadius.round,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        }}
      >
        <Text variant="small" color={theme.colors.textLight} testID="month-chip">
          {monthName(value)}
        </Text>
        <Feather name="calendar" size={16} color={theme.colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Close month list"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: theme.spacing.lg }}
        >
          <View style={{ backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md }}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.borderRadius.lg,
                  backgroundColor: option.value === value ? theme.colors.primaryLight : "transparent",
                }}
              >
                <Text variant="body" weight={option.value === value ? "bold" : "regular"} center>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

export default MonthChip;
