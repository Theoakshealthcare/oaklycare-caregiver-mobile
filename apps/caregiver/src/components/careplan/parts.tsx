import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { riskLabel, type RiskLevel } from "@/src/careplan/carePlanModel";

export const Chip: React.FC<{ label: string; selected: boolean; onPress: () => void; testID?: string; disabled?: boolean }> = ({
  label,
  selected,
  onPress,
  testID,
  disabled,
}) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected, disabled }}
    disabled={disabled}
    onPress={onPress}
    style={{
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.round,
      backgroundColor: selected ? theme.colors.primary : theme.colors.soft,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <Text variant="small" weight="medium" color={selected ? theme.colors.white : theme.colors.text}>
      {label}
    </Text>
  </Pressable>
);

export const Card: React.FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => (
  <View
    testID={testID}
    style={{ backgroundColor: theme.colors.soft, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.sm }}
  >
    {children}
  </View>
);

const RISK_COLORS: Record<RiskLevel, { background: string; text: string }> = {
  low: { background: theme.colors.successLight, text: theme.colors.text },
  medium: { background: theme.colors.secondaryLight, text: theme.colors.warningText },
  high: { background: theme.colors.secondaryLight, text: theme.colors.errorText },
};

/** "High risk": the author's recorded level, never computed by the app. */
export const RiskBadge: React.FC<{ risk: RiskLevel; testID?: string }> = ({ risk, testID }) => (
  <View
    testID={testID}
    style={{
      alignSelf: "flex-start",
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.round,
      backgroundColor: RISK_COLORS[risk].background,
    }}
  >
    <Text variant="caption" weight="medium" color={RISK_COLORS[risk].text}>
      {`${riskLabel(risk)} risk`}
    </Text>
  </View>
);

export const FieldHint: React.FC<{ text: string; testID?: string }> = ({ text, testID }) => (
  <Text variant="caption" color={theme.colors.errorText} testID={testID}>
    {text}
  </Text>
);

/** A titled block that opens and closes (the Care Plan Details sections). */
export const Accordion: React.FC<{
  title: string;
  testID: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, testID, defaultOpen = false, action, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View testID={testID} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.xl, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingRight: theme.spacing.md }}>
        <Pressable
          testID={`${testID}-toggle`}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md }}
        >
          <Text variant="body" weight="bold">
            {title}
          </Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.textLight} />
        </Pressable>
        {action}
      </View>
      {open ? <View style={{ padding: theme.spacing.md, paddingTop: 0, gap: theme.spacing.sm }}>{children}</View> : null}
    </View>
  );
};

/** The popup frame of the add-goal, edit-plan and list-editing sheets. */
export const ModalFrame: React.FC<{ title: string; onClose: () => void; testID: string; children: React.ReactNode }> = ({
  title,
  onClose,
  testID,
  children,
}) => (
  <Modal transparent animationType="fade" visible onRequestClose={onClose}>
    <View testID={testID} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: theme.spacing.md }}>
      <View style={{ backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xxl, maxHeight: "92%" }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Pressable
            testID={`${testID}-close`}
            accessibilityRole="button"
            onPress={onClose}
            style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}
          >
            <Feather name="x-circle" size={18} color={theme.colors.textLight} />
            <Text variant="small" color={theme.colors.textLight}>
              Close
            </Text>
          </Pressable>
          <Text variant="h3" weight="bold" color={theme.colors.primary}>
            {title}
          </Text>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

/**
 * Full-screen notice for a plan that cannot be shown or used: no live visit (404), or a step that needs an
 * active visit. The same shape as `GateMessage`, minus the sign-out button.
 */
export const CarePlanNotice: React.FC<{
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, message, actionLabel, onAction }) => (
  <View testID="care-plan-notice" style={[globalStyles.container, { justifyContent: "center", gap: theme.spacing.md }]}>
    <Text variant="h2" weight="bold" center>
      {title}
    </Text>
    <Text variant="body" color={theme.colors.textLight} center>
      {message}
    </Text>
    {actionLabel && onAction ? <Button title={actionLabel} variant="outline" onPress={onAction} /> : null}
  </View>
);
