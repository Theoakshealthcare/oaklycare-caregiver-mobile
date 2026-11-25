import React from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { DOCUMENTATION_TITLE } from "@/src/careplan/documentationCopy";
import { useVisitCarePlan } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";

const Row: React.FC<{ testID: string; title: string; hint: string; onPress: () => void }> = ({ testID, title, hint, onPress }) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={title}
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    }}
  >
    <View style={{ flex: 1 }}>
      <Text variant="body" weight="bold">
        {title}
      </Text>
      <Text variant="small" color={theme.colors.textLight}>
        {hint}
      </Text>
    </View>
    <Feather name="chevron-right" size={20} color={theme.colors.textLight} />
  </Pressable>
);

/**
 * Two doors from a visit's notes screen. "My documentation" is the caregiver's own private space (any caregiver). "Add a care
 * plan note" appears only after the visit is completed, for the assigned nurse: the server answers the visit's care plan
 * summary for 2 h after completion to a nurse and 404 to everyone else, so the row is simply absent for the others.
 */
const PostVisitLinks: React.FC<{ bookingId: string; completed: boolean }> = ({ bookingId, completed }) => {
  const { navigation } = useNavigation();
  const plan = useVisitCarePlan(bookingId, completed).data?.plan ?? null;
  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
      <Row
        testID="open-documentation"
        title={DOCUMENTATION_TITLE}
        hint="Your own notes for this visit. Private: the family does not see them."
        onPress={() => navigation.navigate("VisitDocumentation", { bookingId })}
      />
      {completed && plan ? (
        <Row
          testID="open-care-plan-note"
          title="Add a care plan note"
          hint="Open the care plan to add a note while the 2-hour window is open."
          onPress={() => navigation.navigate("CarePlanDetails", { planId: plan.id })}
        />
      ) : null}
    </View>
  );
};

export default PostVisitLinks;
