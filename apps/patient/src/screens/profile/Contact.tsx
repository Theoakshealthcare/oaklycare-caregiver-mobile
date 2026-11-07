import type React from "react";
import { Linking } from "react-native";

import Button from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/** Where to reach Oakly. Email only for now: the support WhatsApp number in the design is a placeholder. */
export const SUPPORT_EMAIL = "info@theoakshealthcare.com";

const Contact: React.FC = () => (
  <Screen title="Contact us">
    <Text color={theme.colors.textLight}>Questions about a booking or your account? Email us and we will get back to you.</Text>
    <Card tone="tint">
      <Text variant="small" color={theme.colors.textLight}>
        Email
      </Text>
      <Text weight="bold">{SUPPORT_EMAIL}</Text>
    </Card>
    <Button title="Send an email" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
  </Screen>
);

export default Contact;
