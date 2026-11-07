import type React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Text from "./text";

interface ErrorDialogProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

const ErrorDialog: React.FC<ErrorDialogProps> = ({ visible, title = "Error", message, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <Text variant="h3" weight="bold" color={theme.colors.error} center>
          {title}
        </Text>
        <Text center style={styles.message}>
          {message}
        </Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={onClose}>
          <Text weight="bold" color={theme.colors.white}>
            OK
          </Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" },
  dialog: {
    width: "80%",
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  message: { marginBottom: theme.spacing.sm },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xxl,
    paddingVertical: theme.spacing.sm + 4,
    paddingHorizontal: theme.spacing.xl,
  },
});

export default ErrorDialog;
