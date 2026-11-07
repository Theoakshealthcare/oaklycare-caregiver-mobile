import type React from "react";
import { Linking, View } from "react-native";

import { Card } from "@/src/components/ui/card";
import MenuRow from "@/src/components/ui/menu-row";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { useNav } from "@/src/navigation/Navigations";

/** The pages the FAQs and About rows open in the browser (the owner's site). */
export const FAQ_URL = "https://oaklycare.com/faq";
export const ABOUT_URL = "https://oaklycare.com/about";

/** The settings menu. Only what v1 has: profile, password, FAQs, About, contact, account. Terms and Privacy are hidden until their URLs are known. */
const Profile: React.FC = () => {
  const navigation = useNav();
  const me = useMe();
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
        <MenuRow icon="help-circle-outline" label="FAQs" onPress={() => void Linking.openURL(FAQ_URL)} />
        <MenuRow icon="information-circle-outline" label="About us" onPress={() => void Linking.openURL(ABOUT_URL)} />
        <MenuRow icon="mail-outline" label="Contact us" onPress={() => navigation.navigate("Contact")} />
        <MenuRow icon="shield-checkmark-outline" label="Account and data" onPress={() => navigation.navigate("AccountData")} />
      </View>
    </Screen>
  );
};

export default Profile;
