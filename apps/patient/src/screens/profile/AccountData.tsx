import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import ConfirmDialog from "@/src/components/ui/confirm-dialog";
import MenuRow from "@/src/components/ui/menu-row";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { authService } from "@/src/services/auth.service";

/** Log out, and delete the account for good. */
const AccountData: React.FC = () => {
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // On success the session ends and the auth gate swaps the whole app for the login screen.
  const remove = useMutation({
    mutationFn: () => authService.deleteAccount(),
    onError: (error) => setProblem(messageForError(error)),
  });

  return (
    <Screen title="Account and data">
      <View>
        <MenuRow icon="log-out-outline" label="Log out" destructive onPress={() => void authService.logout()} />
        <MenuRow
          icon="trash-outline"
          label="Delete account"
          destructive
          onPress={() => {
            setProblem(null);
            setConfirming(true);
          }}
        />
      </View>
      <ConfirmDialog
        visible={confirming}
        title="Delete your account?"
        message="Your personal details will be erased and you will not be able to sign in again. This cannot be undone."
        confirmLabel="Yes, delete account"
        cancelLabel="No, go back"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      >
        {problem ? (
          <Text color={theme.colors.secondary} center accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}
      </ConfirmDialog>
    </Screen>
  );
};

export default AccountData;
