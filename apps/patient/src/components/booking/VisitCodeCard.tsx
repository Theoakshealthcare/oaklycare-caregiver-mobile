import type React from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/src/components/ui/card";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/** The 4-digit code the patient reads out to the caregiver on arrival (the caregiver types it; the patient never does). */
const VisitCodeCard: React.FC<{ code: string }> = ({ code }) => (
  <Card tone="tint">
    <Text variant="small" color={theme.colors.textLight}>
      Visit code
    </Text>
    <View style={styles.digits} accessibilityLabel={`Visit code ${code.split("").join(" ")}`}>
      {code.split("").map((digit, index) => (
        <View key={index} style={styles.digit}>
          <Text variant="h2" weight="bold" color={theme.colors.primary}>
            {digit}
          </Text>
        </View>
      ))}
    </View>
    <Text variant="small">Tell this code to your caregiver when they arrive. Do not share it with anyone else.</Text>
  </Card>
);

const styles = StyleSheet.create({
  digits: { flexDirection: "row", gap: theme.spacing.sm },
  digit: {
    width: 48,
    height: 56,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default VisitCodeCard;
