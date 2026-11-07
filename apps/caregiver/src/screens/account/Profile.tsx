import React from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import { ABOUT_URL, FAQ_URL } from "@/src/config/contact";
import HeaderBack from "@/src/components/back/HeaderBack";
import Image from "@/src/components/ui/image";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { authService } from "@/src/services/auth.service";

type IconName = React.ComponentProps<typeof Feather>["name"];

const MenuRow: React.FC<{ icon: IconName; label: string; onPress: () => void; danger?: boolean }> = ({
  icon,
  label,
  onPress,
  danger = false,
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    }}
  >
    <Feather name={icon} size={20} color={danger ? theme.colors.error : theme.colors.primary} />
    <Text variant="body" weight="medium" color={danger ? theme.colors.error : theme.colors.text} style={{ flex: 1 }}>
      {label}
    </Text>
    {danger ? null : <Feather name="chevron-right" size={20} color={theme.colors.text} />}
  </Pressable>
);

const Profile: React.FC = () => {
  const { navigation } = useNavigation();
  const me = useMe();

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
      <ScrollView>
        <View style={globalStyles.container}>
          <HeaderBack />
          <View style={{ marginVertical: "5%" }}>
            <Text variant="h2" weight="bold">
              Profile settings
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
              borderRadius: 16,
              backgroundColor: theme.colors.primaryLight,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                borderWidth: 2,
                borderColor: theme.colors.primary,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {me.data?.profile_image_url ? (
                <Image source={{ uri: me.data.profile_image_url }} style={{ width: 56, height: 56 }} />
              ) : (
                <Feather name="user" size={26} color={theme.colors.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              {me.data ? (
                <>
                  <Text variant="body" weight="bold">
                    {me.data.full_name}
                  </Text>
                  <Text variant="small" color={theme.colors.textLight}>
                    {me.data.email}
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          <MenuRow icon="user" label="Edit personal information" onPress={() => navigation.navigate("EditProfile")} />
          <MenuRow icon="lock" label="Change password" onPress={() => navigation.navigate("ChangePassword")} />
          <MenuRow icon="credit-card" label="Payment & earnings" onPress={() => navigation.navigate("Wallet")} />
          <MenuRow icon="info" label="About us" onPress={() => void Linking.openURL(ABOUT_URL)} />
          <MenuRow icon="help-circle" label="FAQs" onPress={() => void Linking.openURL(FAQ_URL)} />
          <MenuRow icon="phone" label="Contact us" onPress={() => navigation.navigate("Contact")} />
          <MenuRow icon="log-out" label="Logout" onPress={confirmLogout} danger />
          <MenuRow icon="trash-2" label="Delete account" onPress={confirmDelete} danger />
        </View>
      </ScrollView>
    </View>
  );
};

export default Profile;
