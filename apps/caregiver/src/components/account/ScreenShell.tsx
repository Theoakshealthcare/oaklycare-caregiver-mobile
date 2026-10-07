import React from "react";
import { ScrollView, View, type RefreshControlProps } from "react-native";

import HeaderBack from "@/src/components/back/HeaderBack";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";

/** White page with a back link and a title: the frame the account and wallet screens share. */
const ScreenShell: React.FC<{
  title: string;
  subtitle?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  children: React.ReactNode;
}> = ({ title, subtitle, refreshControl, children }) => (
  <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
    <ScrollView refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
      <View style={globalStyles.container}>
        <HeaderBack />
        <View style={{ marginVertical: "5%" }}>
          <Text variant="h2" weight="bold">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={theme.colors.textLight}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
    </ScrollView>
  </View>
);

export default ScreenShell;
