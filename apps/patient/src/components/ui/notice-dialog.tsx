import type React from "react";
import { Modal, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Button from "./button";
import Text from "./text";

interface NoticeDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Default "OK". */
  closeLabel?: string;
  onClose: () => void;
}

/** The app's own one-button message card (same look as the confirm dialog), for good news the native alert used to carry. */
const NoticeDialog: React.FC<NoticeDialogProps> = ({ visible, title, message, closeLabel = "OK", onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <Text variant="h3" weight="bold" center>
          {title}
        </Text>
        <Text color={theme.colors.textLight} center>
          {message}
        </Text>
        <View style={styles.buttons}>
          <Button title={closeLabel} onPress={onClose} />
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

export default NoticeDialog;
