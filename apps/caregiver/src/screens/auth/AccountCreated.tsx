import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { theme } from "../../constants/theme";
import Text from "../../components/ui/text";
import Button from "../../components/ui/button";
import Icon from "../../components/ui/icon";
import SuccessIllustration from "../../components/ui/success-illustration";
import Navigation from "@/src/hooks/use-navigation";
import { globalStyles } from "@/src/constants/styles";
import { takePendingSignIn } from "@/src/auth/pendingSignIn";
import { authService } from "@/src/services/auth.service";

/** The words of the Figma "account created" frame. The body is copied as drawn. */
export const ACCOUNT_CREATED_TITLE = "Congratulations! Your account setup is complete!";
export const ACCOUNT_CREATED_BODY = "Account successfully created! Welcome aboard! Let the learning journey begin!";

const AccountCreated = () => {
  const { navigation } = Navigation();
  const [busy, setBusy] = useState(false);

  // "Set up your Account": the account was just verified, so sign in with what was typed on the sign-up form and the auth
  // gate opens the setup. When that is not possible (the app was restarted, or the sign-in failed) the Login screen does the same.
  const handleSetUp = async () => {
    if (busy) return;
    const credentials = takePendingSignIn();
    if (!credentials) {
      navigation.navigate("Login");
      return;
    }
    setBusy(true);
    try {
      await authService.login(credentials.email, credentials.password);
    } catch {
      setBusy(false);
      navigation.navigate("Login");
    }
  };

  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <Pressable onPress={() => navigation.navigate("Login")} style={globalStyles.row} accessibilityRole="button">
        <Icon name="close-circle-outline" size={24} />
        <Text>Close</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.lg }}>
        <SuccessIllustration />

        <Text variant="h2" weight="bold" color={theme.colors.success} center>
          {ACCOUNT_CREATED_TITLE}
        </Text>

        <Text variant="small" color={theme.colors.textLight} center>
          {ACCOUNT_CREATED_BODY}
        </Text>

        <Button title="Set up your Account" onPress={() => void handleSetUp()} loading={busy} style={{ width: "100%", borderRadius: 30 }} />
      </ScrollView>
    </View>
  );
};

export default AccountCreated;
