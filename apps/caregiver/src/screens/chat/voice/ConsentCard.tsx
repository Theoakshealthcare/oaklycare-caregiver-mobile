import type React from "react"
import { TouchableOpacity, View } from "react-native"
import { Feather } from "@expo/vector-icons"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import { CONSENT_LINE, CONSENT_NOTE, CONSENT_TITLE } from "@/src/voiceNotes/consentCopy"

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** The consent step before recording: the exact line from consentCopy and a checkbox the caregiver ticks (owner decision D2). */
const ConsentCard: React.FC<Props> = ({ checked, onChange }) => (
  <View
    testID="consent-card"
    style={{ backgroundColor: theme.colors.primaryLight, borderRadius: 12, padding: 16, marginBottom: 16 }}
  >
    <Text variant="h3" weight="bold" style={{ marginBottom: 8 }}>
      {CONSENT_TITLE}
    </Text>
    <TouchableOpacity
      testID="consent-checkbox"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={CONSENT_LINE}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
    >
      <Feather name={checked ? "check-square" : "square"} size={24} color={theme.colors.primary} />
      <Text variant="body" style={{ flex: 1 }} testID="consent-line">
        {CONSENT_LINE}
      </Text>
    </TouchableOpacity>
    <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 8 }} testID="consent-note">
      {CONSENT_NOTE}
    </Text>
  </View>
)

export default ConsentCard
