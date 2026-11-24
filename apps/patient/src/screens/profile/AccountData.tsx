import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import CardModal from "@/src/components/ui/card-modal";
import ConfirmDialog from "@/src/components/ui/confirm-dialog";
import MenuRow from "@/src/components/ui/menu-row";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { authService } from "@/src/services/auth.service";

/** "Account and Data" (Figma): Delete Account, then Logout in coral. Logout still asks first (audit P1-09), which the design does not show. */
const AccountData: React.FC = () => {
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // On success the session ends and the auth gate swaps the whole app for the login screen.
  const remove = useMutation({
    mutationFn: () => authService.deleteAccount(),
    onError: (error) => setProblem(messageForError(error)),
  });

  return (
    <Screen title="Account and Data" centerTitle contentStyle={styles.page}>
      <View>
        <MenuRow
          icon="trash-outline"
          label="Delete Account"
          dangerIcon
          onPress={() => {
            setProblem(null);
            setConfirming(true);
          }}
        />
        <MenuRow icon="log-out-outline" label="Logout" destructive chevron={false} last onPress={() => setLoggingOut(true)} />
      </View>
      {/* Not in the design, kept on purpose: logging out asks first (audit P1-09). */}
      <ConfirmDialog
        visible={loggingOut}
        title="Log out?"
        message="You will need to sign in again to use Oakly."
        confirmLabel="Yes, log out"
        cancelLabel="No, stay signed in"
        onConfirm={() => {
          setLoggingOut(false);
          void authService.logout();
        }}
        onCancel={() => setLoggingOut(false)}
      />
      <CardModal
        visible={confirming}
        onClose={() => setConfirming(false)}
        compact
        title="Are you sure you want to Delete Account"
        subtitle="Once you delete your account all your data will be deleted."
      >
        {problem ? (
          <Text color={theme.colors.secondary} center accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}
        <View style={styles.buttons}>
          <Button title="Yes Delete Account" small loading={remove.isPending} onPress={() => remove.mutate()} style={styles.button} />
          <Button title="No, Go Back" small variant="outline" disabled={remove.isPending} onPress={() => setConfirming(false)} style={styles.button} />
        </View>
      </CardModal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  // Figma: the first row sits right under the title.
  page: { paddingTop: 0 },
  buttons: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  button: { flex: 1, paddingHorizontal: theme.spacing.xs },
});

export default AccountData;
