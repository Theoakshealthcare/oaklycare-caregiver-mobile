import type React from "react";
import { StyleSheet, View } from "react-native";

import Avatar from "@/src/components/ui/avatar";
import MenuRow from "@/src/components/ui/menu-row";
import PageHeader from "@/src/components/ui/page-header";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { ABOUT_URL, FAQ_URL, PRIVACY_URL, TERMS_URL } from "@/src/config/links";
import { usePageOpener } from "@/src/hooks/usePageOpener";
import { useNav } from "@/src/navigation/Navigations";

/**
 * "Profile Settings" (Figma): the person's photo, name and "Verified User", then the menu. Only the rows that lead somewhere that
 * exists are here: Family Details, Wallet, Subscription Plan, Live Chat, Drug Reminder, Satisfaction Score, Refer and Earn and
 * Complaints are not part of v1. Terms of Service and Privacy Policy are not in the design but are required to be reachable.
 */
const Profile: React.FC = () => {
  const navigation = useNav();
  const me = useMe();
  const { open, dialog } = usePageOpener();
  return (
    <View style={styles.screen}>
      <PageHeader title="Profile Settings" />
      <KeyboardScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Avatar uri={me.data?.profile_image_url} name={me.data?.full_name} size={56} />
          <View style={styles.who}>
            <Text variant="h3" weight="bold" numberOfLines={1}>
              {me.data?.full_name ?? ""}
            </Text>
            {me.data?.is_verified ? (
              <Text weight="bold" color={theme.colors.primary}>
                Verified User
              </Text>
            ) : null}
          </View>
        </View>
        <View>
          <MenuRow icon="person-outline" label="Edit Personal Information" onPress={() => navigation.navigate("EditProfile")} />
          <MenuRow icon="help-circle-outline" label="FAQs" onPress={() => open("FAQs", FAQ_URL)} />
          <MenuRow icon="information-circle-outline" label="About Us" onPress={() => open("About Us", ABOUT_URL)} />
          <MenuRow icon="call-outline" label="Contact Us" onPress={() => navigation.navigate("Contact")} />
          <MenuRow icon="document-text-outline" label="Terms of Service" onPress={() => open("Terms of Service", TERMS_URL)} />
          <MenuRow icon="shield-outline" label="Privacy Policy" onPress={() => open("Privacy Policy", PRIVACY_URL)} />
          <MenuRow icon="shield-checkmark-outline" label="Account and Data" onPress={() => navigation.navigate("AccountData")} />
        </View>
        {dialog}
      </KeyboardScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md },
  who: { flex: 1, gap: 2 },
});

export default Profile;
