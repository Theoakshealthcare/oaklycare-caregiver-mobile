import type React from "react";
import { View } from "react-native";

import { Card } from "@/src/components/ui/card";
import MenuRow from "@/src/components/ui/menu-row";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { ABOUT_URL, FAQ_URL, PRIVACY_URL, TERMS_URL } from "@/src/config/links";
import { usePageOpener } from "@/src/hooks/usePageOpener";
import { useNav } from "@/src/navigation/Navigations";

/** The settings menu: profile, password, FAQs, About, Terms, Privacy, contact, account. The web pages open in the in-app browser. */
const Profile: React.FC = () => {
  const navigation = useNav();
  const me = useMe();
  const { open, dialog } = usePageOpener();
  return (
    <Screen title="Profile settings" scroll>
      <Card tone="tint">
        <Text variant="h3" weight="bold">
          {me.data?.full_name ?? ""}
        </Text>
        {me.data?.email ? (
          <Text variant="small" color={theme.colors.textLight}>
            {me.data.email}
          </Text>
        ) : null}
      </Card>
      <View>
        <MenuRow icon="person-outline" label="Edit personal information" onPress={() => navigation.navigate("EditProfile")} />
        <MenuRow icon="lock-closed-outline" label="Change password" onPress={() => navigation.navigate("ChangePassword")} />
        <MenuRow icon="help-circle-outline" label="FAQs" onPress={() => open("FAQs", FAQ_URL)} />
        <MenuRow icon="information-circle-outline" label="About us" onPress={() => open("About us", ABOUT_URL)} />
        <MenuRow icon="document-text-outline" label="Terms of Service" onPress={() => open("Terms of Service", TERMS_URL)} />
        <MenuRow icon="shield-outline" label="Privacy Policy" onPress={() => open("Privacy Policy", PRIVACY_URL)} />
        <MenuRow icon="mail-outline" label="Contact us" onPress={() => navigation.navigate("Contact")} />
        <MenuRow icon="shield-checkmark-outline" label="Account and data" onPress={() => navigation.navigate("AccountData")} />
      </View>
      {dialog}
    </Screen>
  );
};

export default Profile;
