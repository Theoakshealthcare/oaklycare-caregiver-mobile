import React from "react";
import { Linking, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import ScreenShell from "@/src/components/account/ScreenShell";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { CONTACT_EMAIL, WHATSAPP_NUMBER, whatsappUrl } from "@/src/config/contact";

const Channel: React.FC<{
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  detail: string;
  onPress?: () => void;
}> = ({ icon, label, detail, onPress }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      marginBottom: 8,
    }}
  >
    <Feather name={icon} size={22} color={theme.colors.primary} />
    <View style={{ flex: 1 }}>
      <Text variant="body" weight="bold">
        {label}
      </Text>
      <Text variant="small" color={theme.colors.textLight}>
        {detail}
      </Text>
    </View>
  </Pressable>
);

const Contact: React.FC = () => {
  const whatsapp = whatsappUrl();
  return (
    <ScreenShell title="Contact Us">
      {/* Figma's first row, "Chat with a support agent", is not drawn: the support live chat is not built. */}
      <Channel
        icon="mail"
        label="Send an email"
        detail={`send us an email at ${CONTACT_EMAIL}`}
        onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
      />
      {/* No dead row: WhatsApp appears only once the owner supplies a number (DP1-24). Calling stays hidden (CALLING_ENABLED). */}
      {whatsapp ? (
        <Channel icon="message-circle" label="Send us a DM on Whatsapp" detail={WHATSAPP_NUMBER} onPress={() => void Linking.openURL(whatsapp)} />
      ) : null}
    </ScreenShell>
  );
};

export default Contact;
