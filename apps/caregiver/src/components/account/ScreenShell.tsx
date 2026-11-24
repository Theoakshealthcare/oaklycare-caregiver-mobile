import React from "react";
import { Pressable, View, type RefreshControlProps } from "react-native";
import { useNavigation } from "@react-navigation/native";

import HeaderBack from "@/src/components/back/HeaderBack";
import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";

/** A round, pale back button on the left and the title centred under it (Figma: Contact Us, Refer and Earn). */
const CenteredTitleBar: React.FC<{ title: string }> = ({ title }) => {
  const navigation = useNavigation();
  return (
    <View style={{ marginBottom: theme.spacing.lg, gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => navigation.goBack()}
        style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="chevron-back" size={18} />
      </Pressable>
      <Text variant="subtitle" weight="bold" center>
        {title}
      </Text>
    </View>
  );
};

/** White page with a back link and a title: the frame the account and wallet screens share. */
const ScreenShell: React.FC<{
  title: string;
  subtitle?: string;
  /** Figma's Contact Us style: a round back button and the title centred (the other pages use "< Back" and a left title). */
  centered?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  children: React.ReactNode;
}> = ({ title, subtitle, centered = false, refreshControl, children }) => (
  <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
    <KeyboardScrollView refreshControl={refreshControl}>
      <View style={globalStyles.container}>
        {centered ? <CenteredTitleBar title={title} /> : <HeaderBack />}
        {centered ? null : <View style={{ marginVertical: "5%" }}>
          <Text variant="page" weight="bold">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={theme.colors.textLight}>
              {subtitle}
            </Text>
          ) : null}
        </View>}
        {children}
      </View>
    </KeyboardScrollView>
  </View>
);

export default ScreenShell;
