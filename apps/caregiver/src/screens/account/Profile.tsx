import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ABOUT_URL, FAQ_URL } from "@/src/config/contact";
import HeaderBack from "@/src/components/back/HeaderBack";
import Image from "@/src/components/ui/image";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useCaregiverHome, useMe } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { openPageOrAlert } from "@/src/services/openPageOrAlert";

/** FAQs and About us open inside the app; a page that cannot open says so in the app's usual alert. */
const openInApp = openPageOrAlert;

type IconName = React.ComponentProps<typeof Feather>["name"];

const MenuRow: React.FC<{ icon: IconName; label: string; onPress: () => void }> = ({ icon, label, onPress }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 21,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    }}
  >
    <Feather name={icon} size={20} color={theme.colors.primary} />
    <Text variant="small" weight="medium" style={{ flex: 1 }}>
      {label}
    </Text>
    <Feather name="chevron-right" size={20} color={theme.colors.text} />
  </Pressable>
);

const Profile: React.FC = () => {
  const { navigation } = useNavigation();
  const me = useMe();

  // Care plans are a nurse's tool: the server says who may author them (the hub hides itself for anyone else).
  const canAuthorCarePlans = useCaregiverHome().data?.can_author_care_plans === true;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView>
        <View style={globalStyles.container}>
          <HeaderBack />
          <View style={{ marginVertical: "5%" }}>
            <Text variant="page" weight="bold">
              Profile Settings
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
                  <Text variant="small" weight="medium" color={theme.colors.primary}>
                    Verified User
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          <MenuRow icon="user" label="Edit Personal Information" onPress={() => navigation.navigate("EditProfile")} />
          <MenuRow icon="credit-card" label="Payment & Earnings" onPress={() => navigation.navigate("Wallet")} />
          {canAuthorCarePlans ? <MenuRow icon="folder" label="Care Plan" onPress={() => navigation.navigate("CarePlans")} /> : null}
          <MenuRow icon="info" label="About Us" onPress={() => openInApp("About Us", ABOUT_URL)} />
          <MenuRow icon="help-circle" label="FAQs" onPress={() => openInApp("FAQs", FAQ_URL)} />
          <MenuRow icon="lock" label="Security" onPress={() => navigation.navigate("ChangePassword")} />
          <MenuRow icon="phone" label="Contact Us" onPress={() => navigation.navigate("Contact")} />
          <MenuRow icon="file-text" label="Account and Data" onPress={() => navigation.navigate("AccountData")} />
        </View>
      </ScrollView>
    </View>
  );
};

export default Profile;
