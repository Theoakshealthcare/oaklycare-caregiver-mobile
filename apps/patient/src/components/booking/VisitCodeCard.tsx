import type React from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/src/components/ui/card";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/**
 * The 4-digit code the patient reads out to the caregiver on arrival (the caregiver types it; the patient never does).
 * It is never logged, never put in a notification or a share sheet, and only drawn by screens that read it from the
 * booking detail while the booking is accepted or on the way.
 */
const VisitCodeCard: React.FC<{ code: string }> = ({ code }) => (
  <Card tone="tint">
    <Text variant="small" color={theme.colors.textLight}>
      Visit code
    </Text>
    <View style={styles.digits} accessibilityLabel={`Visit code ${code.split("").join(" ")}`}>
      {code.split("").map((digit, index) => (
        <View key={index} style={styles.digit}>
          <Text variant="h1" weight="bold" color={theme.colors.primary} style={styles.digitText}>
            {digit}
          </Text>
        </View>
      ))}
    </View>
    <Text weight="bold">Give this code to your caregiver when they arrive</Text>
    <Text variant="small" color={theme.colors.textLight}>
      Your caregiver types it in to start the visit. Do not share it with anyone else.
    </Text>
  </Card>
);

const styles = StyleSheet.create({
  digits: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.sm },
  digit: {
    width: 64,
    height: 80,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  digitText: { fontSize: theme.sizes.display * 1.6, lineHeight: theme.sizes.display * 1.9 },
});

export default VisitCodeCard;
