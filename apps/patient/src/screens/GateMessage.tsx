import type React from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

interface Props {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onSignOut: () => void;
}

/** A full-screen notice for states where the user cannot continue (load failed, wrong account). */
const GateMessage: React.FC<Props> = ({ title, message, actionLabel, onAction, onSignOut }) => (
  <View style={styles.container}>
    <Text variant="h2" weight="bold" center>
      {title}
    </Text>
    <Text color={theme.colors.textLight} center>
      {message}
    </Text>
    {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    <Button title="Sign out" variant="outline" onPress={onSignOut} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white, padding: theme.spacing.lg, justifyContent: "center", gap: theme.spacing.md },
});

export default GateMessage;
