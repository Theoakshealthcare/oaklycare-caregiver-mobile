import type React from "react";
import { Modal, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Button from "./button";
import Text from "./text";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Extra content between the message and the buttons (fee rows, a text box). */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** The confirm button is coral for a destructive step. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A centred two-button dialog over a dimmed overlay ("Are you sure you want to cancel your booking?"). */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  children,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <Text variant="h3" weight="bold" center>
          {title}
        </Text>
        {message ? (
          <Text color={theme.colors.textLight} center>
            {message}
          </Text>
        ) : null}
        {children}
        <View style={styles.buttons}>
          <Button title={cancelLabel} onPress={onCancel} disabled={loading} />
          <Button title={confirmLabel} variant={destructive ? "danger" : "outline"} onPress={onConfirm} loading={loading} />
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: theme.spacing.lg },
  dialog: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  buttons: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
});

export default ConfirmDialog;
