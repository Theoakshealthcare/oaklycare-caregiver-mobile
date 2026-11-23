import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Icon from "@/src/components/ui/icon";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";

/** "Vital Report Downloaded Successfully" (Figma): the full-screen frame after the report was handed to the share sheet. */
const VitalReport: React.FC = () => {
  const navigation = useNav();
  return (
    <View style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => navigation.goBack()} style={styles.close}>
        <Icon name="close-circle-outline" size={26} />
      </Pressable>
      <View style={styles.body}>
        <SuccessIllustration />
        <Text variant="h3" weight="bold" color={theme.colors.successTitle} center>
          Vital Report Downloaded Successfully
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.pageTint, padding: theme.spacing.lg, paddingTop: theme.spacing.xxl },
  close: { alignSelf: "flex-start" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 },
});

export default VitalReport;
