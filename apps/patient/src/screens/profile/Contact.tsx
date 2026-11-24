import type React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import Icon from "@/src/components/ui/icon";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/** Where to reach Oakly. */
export const SUPPORT_EMAIL = "info@theoakshealthcare.com";

/**
 * "Contact Us" (Figma): one row per way to reach Oakly. Only e-mail is here: "Chat with a support agent" needs the support chat
 * (not in v1) and the WhatsApp number in the design is a placeholder.
 */
const Contact: React.FC = () => (
  <Screen title="Contact Us" centerTitle contentStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="Send an email" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={styles.row}>
      <Icon name="mail-outline" size={22} color={theme.colors.primary} />
      <View style={styles.text}>
        <Text weight="bold">Send an email</Text>
        <Text variant="small" color={theme.colors.textLight}>
          {`send us an email at ${SUPPORT_EMAIL}`}
        </Text>
      </View>
    </Pressable>
  </Screen>
);

const styles = StyleSheet.create({
  // Figma: the first row sits right under the title.
  page: { paddingTop: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
  text: { flex: 1 },
});

export default Contact;
