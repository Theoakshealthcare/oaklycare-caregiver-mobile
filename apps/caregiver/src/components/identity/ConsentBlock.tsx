import React from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import LegalLink from "@/src/components/ui/legal-link";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { CONSENT_BODY, CONSENT_LABEL } from "@/src/identity/identityModel";

/**
 * The separate, explicit identity consent (design 10.2): the words, then its own tick box. It is not part of the
 * terms and nothing here is pre-ticked.
 */
const ConsentBlock: React.FC<{ checked: boolean; onToggle: () => void; disabled?: boolean }> = ({
  checked,
  onToggle,
  disabled = false,
}) => (
  <View style={{ gap: 12 }}>
    {/* No heading: the Figma identity step has none; the words below are the consent. */}
    <Text testID="identity-consent-text" variant="small" color={theme.colors.text} style={{ lineHeight: 19 }}>
      {CONSENT_BODY}
    </Text>
    <Text variant="small">
      <LegalLink page="privacy">Privacy Policy</LegalLink>
    </Text>
    <Pressable
      testID="identity-consent-check"
      accessibilityRole="checkbox"
      accessibilityLabel={CONSENT_LABEL}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: theme.borderRadius.sm,
          borderWidth: 2,
          borderColor: theme.colors.primary,
          backgroundColor: checked ? theme.colors.primary : theme.colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Feather name="check" size={16} color={theme.colors.white} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body">{CONSENT_LABEL}</Text>
      </View>
    </Pressable>
  </View>
);

export default ConsentBlock;
