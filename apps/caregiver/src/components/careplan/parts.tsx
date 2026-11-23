import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Button from "@/src/components/ui/button";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
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

/** The light-mint circle with a teal chevron that opens and closes a section (Figma). */
const ChevronDisc: React.FC<{ open: boolean }> = ({ open }) => (
  <View
    style={{
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.primary} />
  </View>
);

/** A titled white card that opens and closes (the Care Plan Details sections). Closed by default, as the Figma frames draw it. */
export const Accordion: React.FC<{
  title: string;
  testID: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  /** After the first open, closing only hides the content, so typed text and the chosen day survive; nothing loads before it is opened. */
  keepMounted?: boolean;
  children: React.ReactNode;
}> = ({ title, testID, defaultOpen = false, action, keepMounted = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);
  return (
    <View testID={testID} style={{ backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xl, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingRight: theme.spacing.md }}>
        <Pressable
          testID={`${testID}-toggle`}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            setEverOpened(true);
            setOpen((v) => !v);
          }}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md }}
        >
          <Text variant="body" weight="medium">
            {title}
          </Text>
          <ChevronDisc open={open} />
        </Pressable>
        {action}
      </View>
      {open || (keepMounted && everOpened) ? (
        <View style={{ padding: theme.spacing.md, paddingTop: 0, gap: theme.spacing.md, display: open ? "flex" : "none" }}>{children}</View>
      ) : null}
    </View>
  );
};

/** "+ Add New Care Goal": the pale coral pill with teal text that ends a section's list. */
export const AddLink: React.FC<{ label: string; onPress: () => void; testID: string; align?: "center" | "flex-end" }> = ({
  label,
  onPress,
  testID,
  align = "center",
}) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    hitSlop={8}
    style={{
      alignSelf: align,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.secondaryLight,
    }}
  >
    <Feather name="plus" size={16} color={theme.colors.primary} />
    <Text variant="small" weight="medium" color={theme.colors.primary}>
      {label}
    </Text>
  </Pressable>
);

/** The popup frame of the add-task, add-goal, edit-plan and list-editing sheets: Close, a teal centred title, an optional sub-line. */
export const ModalFrame: React.FC<{ title: string; subtitle?: string; onClose: () => void; testID: string; children: React.ReactNode }> = ({
  title,
  subtitle,
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
            <Feather name="x-circle" size={18} color={theme.colors.text} />
            <Text variant="small" weight="medium">
              Close
            </Text>
          </Pressable>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="h3" weight="bold" color={theme.colors.primary} center accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="small" center testID={`${testID}-subtitle`}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

/**
 * "Add New Medication Schedule": a full page over the details (back button, bold title, a sub-line, the fields, and a
 * pinned teal button), drawn in a full-screen modal so the details underneath keep their place.
 */
export const FullPageFrame: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  testID: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, testID, footer, children }) => (
  <Modal animationType="slide" visible onRequestClose={onClose}>
    <View testID={testID} style={{ flex: 1, backgroundColor: theme.colors.careBackground }}>
      <KeyboardScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.md, paddingTop: theme.spacing.xxl, gap: theme.spacing.md }}>
        <RoundBack onPress={onClose} testID={`${testID}-close`} />
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h2" weight="bold" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" color={theme.colors.textLight} testID={`${testID}-subtitle`}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </KeyboardScrollView>
      <View style={{ padding: theme.spacing.md, paddingBottom: theme.spacing.lg, backgroundColor: theme.colors.careBackground }}>{footer}</View>
    </View>
  </Modal>
);

/** The round white back button of the care plan frames. */
export const RoundBack: React.FC<{ onPress: () => void; testID?: string; light?: boolean }> = ({ onPress, testID, light = false }) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel="Back"
    onPress={onPress}
    hitSlop={8}
    style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: light ? "transparent" : theme.colors.white,
      borderWidth: 1,
      borderColor: light ? theme.colors.white : theme.colors.border,
    }}
  >
    <Feather name="chevron-left" size={22} color={light ? theme.colors.white : theme.colors.text} />
  </Pressable>
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
