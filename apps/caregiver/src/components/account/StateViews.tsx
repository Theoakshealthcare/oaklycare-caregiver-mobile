import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

export const LoadingState: React.FC<{ testID: string }> = ({ testID }) => (
  <ActivityIndicator testID={testID} style={{ marginTop: 40 }} size="large" color={theme.colors.primary} />
);

export const ErrorState: React.FC<{ error: unknown; onRetry: () => void }> = ({ error, onRetry }) => (
  <View style={{ gap: 12, paddingVertical: 20 }}>
    <Text variant="body" color={theme.colors.textLight}>
      {messageForError(error)}
    </Text>
    <Button title="Try again" onPress={onRetry} />
  </View>
);

export const EmptyState: React.FC<{
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  hint: string;
}> = ({ icon, title, hint }) => (
  <View style={{ alignItems: "center", padding: 24 }}>
    <Feather name={icon} size={44} color={theme.colors.primary} style={{ marginBottom: 8 }} />
    <Text variant="body" weight="bold" style={{ marginBottom: 4 }}>
      {title}
    </Text>
    <Text variant="small" color={theme.colors.textLight} style={{ textAlign: "center" }}>
      {hint}
    </Text>
  </View>
);
