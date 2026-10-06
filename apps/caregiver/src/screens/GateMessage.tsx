import React from "react";
import { View } from "react-native";

import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";

interface Props {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onSignOut: () => void;
}

/** Full-screen notice shown by the auth gate when the account cannot be used yet. */
const GateMessage: React.FC<Props> = ({ title, message, actionLabel, onAction, onSignOut }) => (
  <View style={[globalStyles.container, { justifyContent: "center", gap: 16 }]}>
    <Text variant="h2" weight="bold" center>
      {title}
    </Text>
    <Text variant="body" color={theme.colors.textLight} center>
      {message}
    </Text>
    {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    <Button title="Sign out" variant="outline" onPress={onSignOut} />
  </View>
);

export default GateMessage;
