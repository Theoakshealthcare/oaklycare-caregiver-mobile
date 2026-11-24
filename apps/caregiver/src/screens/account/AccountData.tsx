import React from "react";
import { Alert, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import HeaderBack from "@/src/components/back/HeaderBack";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { authService } from "@/src/services/auth.service";

/**
 * "Account and Data" on the profile menu. Figma shows this page (titled "Edit Profile" there, the same name as the
 * personal-information page) with just "Delete Account" and a red "Logout"; it is titled like the row that opens it.
 */
const AccountData: React.FC = () => {
  const confirmLogout = () =>
    Alert.alert("Log out", "Do you want to log out of Oakly?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void authService.logout() },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "Your personal details will be removed and you will be signed out. This cannot be undone. You can't delete your account while you have active bookings or money in your wallet: finish your visits and wait until your balance has been paid out to your bank account. Records we must keep by law, such as past bookings and payments, are kept without your details.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            authService.deleteAccount().catch((error: unknown) => {
              Alert.alert("Couldn't delete your account", messageForError(error));
            });
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <View style={globalStyles.container}>
        <HeaderBack />
        <View style={{ marginVertical: "5%" }}>
          <Text variant="page" weight="bold">
            Account and Data
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={confirmDelete}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <Feather name="trash-2" size={20} color={theme.colors.error} />
          <Text variant="body" weight="medium" style={{ flex: 1 }}>
            Delete Account
          </Text>
          <Feather name="chevron-right" size={20} color={theme.colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={confirmLogout}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}
        >
          <Feather name="log-out" size={20} color={theme.colors.error} />
          <Text variant="body" weight="medium" color={theme.colors.error}>
            Logout
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default AccountData;
