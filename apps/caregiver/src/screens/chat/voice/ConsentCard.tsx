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

/**
 * The consent step before recording: the exact line from consentCopy and a checkbox the caregiver ticks (owner decision D2).
 * Layout: a titled card, the confirmation beside a square checkbox (the whole row is the tap target), a hairline, then the
 * storage note with a lock. The words are untouched (counsel reviews them); only the drawing changed.
 */
const ConsentCard: React.FC<Props> = ({ checked, onChange }) => (
  <View
    testID="consent-card"
    style={{
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.borderRadius.xl,
      borderWidth: 1,
      borderColor: checked ? theme.colors.primary : "#CDEBEB",
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      gap: 12,
    }}
  >
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="shield" size={16} color={theme.colors.primary} />
      </View>
      <Text variant="body" weight="bold" style={{ fontSize: theme.sizes.subtitle }}>
        {CONSENT_TITLE}
      </Text>
    </View>

    <TouchableOpacity
      testID="consent-checkbox"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={CONSENT_LINE}
      activeOpacity={0.7}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: theme.colors.primary,
          backgroundColor: checked ? theme.colors.primary : theme.colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Feather name="check" size={16} color={theme.colors.white} /> : null}
      </View>
      <Text variant="small" style={{ flex: 1, lineHeight: 20 }} testID="consent-line">
        {CONSENT_LINE}
      </Text>
    </TouchableOpacity>

    <View style={{ height: 1, backgroundColor: "#CDEBEB" }} />

    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <Feather name="lock" size={14} color={theme.colors.textLight} style={{ marginTop: 2 }} />
      <Text variant="caption" color={theme.colors.textLight} style={{ flex: 1 }} testID="consent-note">
        {CONSENT_NOTE}
      </Text>
    </View>
  </View>
)

export default ConsentCard
