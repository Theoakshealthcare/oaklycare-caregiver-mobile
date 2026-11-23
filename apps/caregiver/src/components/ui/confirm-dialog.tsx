import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { theme } from "@/src/constants/theme";

import Button from "./button";
import Text from "./text";

export interface ConfirmDialogProps {
  visible: boolean;
  /** "Close" at the top, the hardware back button and a tap outside all call this. */
  onClose: () => void;
  title: string;
  body?: string;
  /** Picture above the title (the decline dialog's calendar-x). */
  illustration?: React.ReactNode;
  /** A big teal clock reading ("10:10:00") above the title: the clock-in and clock-out dialogs. */
  timer?: string | null;
  /** An extra paragraph the caregiver must read before confirming (pay held for review, care plan reminder ...). */
  notice?: string;
  /** The filled button on the left. Figma: "No, Go Back". */
  cancelLabel: string;
  /** The outlined button on the right. Figma: "Yes, Clock out", "Yes, Decline". */
  confirmLabel: string;
  onConfirm: () => void;
  confirmLoading?: boolean;
  /** An optional link under the buttons (for example "Review care plan"). */
  extraLabel?: string;
  onExtra?: () => void;
}

/**
 * The white confirmation card from the Figma exports (decline a booking, clock in, clock out): "Close" with a circled x
 * at the top left, an optional picture or big timer, a green title, a grey explanation and two pills. It replaces the
 * native alerts for those choices. The filled pill is always the safe one ("No, Go Back"); the outlined one confirms.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  onClose,
  title,
  body,
  illustration,
  timer,
  notice,
  cancelLabel,
  confirmLabel,
  onConfirm,
  confirmLoading = false,
  extraLabel,
  onExtra,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop} testID="confirm-dialog">
      <View style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close} hitSlop={8}>
          <Feather name="x-circle" size={20} color={theme.colors.textLight} />
          <Text variant="body" color={theme.colors.text}>
            Close
          </Text>
        </Pressable>

        <View style={styles.content}>
          {illustration ?? null}
          {timer ? (
            <Text variant="h1" weight="bold" color={theme.colors.primary} testID="dialog-timer" accessibilityRole="timer">
              {timer}
            </Text>
          ) : null}
          <Text variant="h2" weight="bold" color={theme.colors.primary} center>
            {title}
          </Text>
          {body ? (
            <Text variant="small" color={theme.colors.textLight} center>
              {body}
            </Text>
          ) : null}
          {notice ? (
            <Text variant="small" color={theme.colors.warningText} center testID="dialog-notice">
              {notice}
            </Text>
          ) : null}
        </View>

        <View style={styles.buttons}>
          <Button title={cancelLabel} onPress={onClose} disabled={confirmLoading} style={styles.button} />
          <Button
            title={confirmLabel}
            variant="outline"
            onPress={onConfirm}
            loading={confirmLoading}
            disabled={confirmLoading}
            style={styles.button}
          />
        </View>
        {extraLabel && onExtra ? (
          <Text variant="small" weight="medium" color={theme.colors.primary} center onPress={onExtra} style={styles.extra}>
            {extraLabel}
          </Text>
        ) : null}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.white,
    borderRadius: 28,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  close: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, alignSelf: "flex-start" },
  content: { alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  buttons: { flexDirection: "row", gap: theme.spacing.md },
  button: { flex: 1, paddingHorizontal: theme.spacing.sm },
  extra: { paddingTop: theme.spacing.xs },
});

export default ConfirmDialog;
