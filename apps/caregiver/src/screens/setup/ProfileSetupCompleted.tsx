import React from "react";
import { Pressable, ScrollView, View } from "react-native";

import Button from "@/src/components/ui/button";
import Icon from "@/src/components/ui/icon";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { resetSetupSubmitted } from "@/src/onboarding/setupSubmitted";

/** The words of the Figma frame, with its two typos fixed ("uploaded" -> "notified", "Homeoage" -> "Homepage"). */
export const SETUP_COMPLETED_TITLE = "Profile Setup Completed";
export const SETUP_COMPLETED_BODY = "Your Profile verification is under review, you will be notified in 24hrs.";

/**
 * Shown once, right after the consent is accepted and before the "under review" status screen. A caregiver cannot reach the
 * app proper until an admin approves the profile, so "Go to Homepage" (and Close) open the status screen, which is their
 * home while the review runs.
 */
const ProfileSetupCompleted: React.FC = () => {
  const done = () => resetSetupSubmitted();

  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <Pressable onPress={done} style={globalStyles.row} accessibilityRole="button" accessibilityLabel="Close">
        <Icon name="close-circle-outline" size={24} />
        <Text>Close</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.lg }}>
        <SuccessIllustration />
        <Text variant="h2" weight="bold" color={theme.colors.success} center>
          {SETUP_COMPLETED_TITLE}
        </Text>
        <Text variant="small" color={theme.colors.textLight} center>
          {SETUP_COMPLETED_BODY}
        </Text>
        <Button title="Go to Homepage" onPress={done} style={{ width: "100%", borderRadius: 30 }} />
      </ScrollView>
    </View>
  );
};

export default ProfileSetupCompleted;
