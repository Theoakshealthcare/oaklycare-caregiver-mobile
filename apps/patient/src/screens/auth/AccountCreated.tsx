import type React from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { requestBookingStart, takeBookingStart, takePendingSignIn } from "@/src/auth/pendingSignIn";
import Button from "@/src/components/ui/button";
import Icon from "@/src/components/ui/icon";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

/** The words of the Figma "account created" frame; the body is copied as drawn. */
export const ACCOUNT_CREATED_TITLE = "Congratulations! Your account setup is complete!";
export const ACCOUNT_CREATED_BODY = "Account successfully created! Welcome aboard! Let the learning journey begin!";

/** Shown once the email is verified. The account is not signed in yet, so "Start Booking Journey" signs in first. */
const AccountCreated: React.FC = () => {
  const navigation = useNav();
  const [busy, setBusy] = useState(false);

  // The account was just verified, so sign in with what was typed on the sign-up form; the auth gate opens the app and Home
  // opens the booking form. When that is not possible (the app was restarted, or the sign-in failed) Login does the same job.
  const startBooking = async () => {
    if (busy) return;
    const credentials = takePendingSignIn();
    if (!credentials) {
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      return;
    }
    setBusy(true);
    requestBookingStart();
    try {
      await authService.login(credentials.email, credentials.password);
    } catch {
      // The sign-in failed, so no app opens: forget the request, or the next successful login would open the booking form.
      takeBookingStart();
      setBusy(false);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }
  };

  return (
    <View style={styles.screen}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })}
        style={styles.close}
      >
        <Icon name="close-circle-outline" size={24} />
        <Text>Close</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.body}>
        <SuccessIllustration />
        <View style={styles.title}>
          <Text variant="page" weight="bold" color={theme.colors.successTitle} center>
            {ACCOUNT_CREATED_TITLE}
          </Text>
        </View>
        <View style={styles.text}>
          <Text variant="fine" color={theme.colors.textLight} center>
            {ACCOUNT_CREATED_BODY}
          </Text>
        </View>
        <Button title="Start Booking Journey" onPress={() => void startBooking()} loading={busy} style={styles.button} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white, paddingHorizontal: theme.spacing.md + 4, paddingTop: theme.spacing.lg },
  close: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, alignSelf: "flex-start" },
  body: { flexGrow: 1, alignItems: "center", paddingTop: theme.spacing.xl },
  title: { width: "85%", marginTop: 32 },
  text: { width: "78%", marginTop: 12 },
  button: { width: "72%", minHeight: 52, marginTop: 36 },
});

export default AccountCreated;
