import { useNavigation } from "@react-navigation/native";
import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Icon from "./icon";
import Text from "./text";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

/** A round back button over a large left-aligned page title and a grey line (Figma: "Profile Settings", "Heart Rate Monitoring"). */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle }) => {
  const navigation = useNavigation();
  return (
    <View style={styles.wrap}>
      {navigation.canGoBack() ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-back" size={22} />
        </Pressable>
      ) : null}
      <Text variant="h2" weight="bold" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="small" color={theme.colors.textLight}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.md, gap: theme.spacing.xs },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  title: { marginTop: theme.spacing.xs },
});

export default PageHeader;
