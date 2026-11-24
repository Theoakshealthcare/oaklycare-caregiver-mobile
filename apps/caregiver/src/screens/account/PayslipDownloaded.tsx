import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import Icon from "@/src/components/ui/icon";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { monthName } from "@/src/wallet/walletModel";

type Props = StackScreenProps<ScreenParamLists, "PayslipDownloaded">;

/** "April Payslip Downloaded Successfully": the words of the Figma frame (its stray space before the full stop is not copied). */
export const payslipTitle = (month: string) => `${monthName(month)} Payslip Downloaded Successfully`;
export const PAYSLIP_BODY = "Your Payslip has been downloaded successfully.";

/** The page that confirms a payslip was made, after the share sheet closes. Close returns to the Earning Payment list. */
const PayslipDownloaded: React.FC<Props> = ({ route }) => {
  const { navigation } = useNavigation();
  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <Pressable onPress={() => navigation.goBack()} style={globalStyles.row} accessibilityRole="button" accessibilityLabel="Close">
        <Icon name="close-circle-outline" size={24} />
        <Text>Close</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingTop: theme.spacing.xl }}>
        <SuccessIllustration />

        <View style={{ marginTop: 32, paddingHorizontal: theme.spacing.md }}>
          <Text variant="page" weight="bold" color={theme.colors.successTitle} center>
            {payslipTitle(route.params.month)}
          </Text>
        </View>

        <View style={{ width: "54%", marginTop: 12 }}>
          <Text variant="fine" color={theme.colors.textLight} center>
            {PAYSLIP_BODY}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default PayslipDownloaded;
