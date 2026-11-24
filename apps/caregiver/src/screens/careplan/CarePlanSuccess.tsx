import React from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import Button from "@/src/components/ui/button";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useCarePlan } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";
import { openCreatedPlan } from "@/src/navigation/carePlanStack";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "CarePlanSuccess">;

/**
 * The words of the Figma frames. `message(name)` is the sub-line "... added for Mrs Grace Ajayi"; without the client's name
 * (the plan has not loaded) the sub-line is left out rather than guessed. A new plan has a title only, and no button: Close
 * is what opens it.
 */
const COPY = {
  created: {
    title: "New Care Plan Created Successfully",
    message: () => null,
    action: null,
  },
  goal_added: {
    title: "New Care Goal has been added Successfully",
    message: (name: string) => `New Care Goal has been added for ${name}`,
    action: "View Care Goal",
  },
  task_added: {
    title: "New Daily Task added Successfully",
    message: (name: string) => `New Task has been added for ${name}`,
    action: "View Task",
  },
  medication_added: {
    title: "New Medication Schedule has been added Successfully",
    message: (name: string) => `New Medication Schedule has been added for ${name}`,
    action: "View Medication Schedule",
  },
} as const;

/** The shared success page ("plan created", "goal added", "task added", "medication added"): Close, the check picture, a green title. */
const CarePlanSuccess: React.FC<Props> = ({ route }) => {
  const { kind, planId } = route.params;
  const { navigation } = useNavigation();
  const copy = COPY[kind];
  // The details screen underneath already holds the plan, so this is a cache read in the normal flow (no extra request).
  const name = useCarePlan(planId, true).data?.client.full_name;
  const message = name ? copy.message(name) : null;

  // A new plan replaces this page with its details; a new goal, task or medication returns to the details underneath.
  // "Created" also drops the creation screens (picker, form, this page) so Back reaches the hub (DP1-26).
  const view = () => (kind === "created" ? navigation.dispatch(openCreatedPlan(planId)) : navigation.goBack());

  return (
    <View style={[globalStyles.container, { flex: 1, backgroundColor: theme.colors.careBackground }]}>
      <Pressable testID="success-close" accessibilityRole="button" accessibilityLabel="Close" onPress={view} hitSlop={12} style={{ alignSelf: "flex-start" }}>
        <Feather name="x-circle" size={24} color={theme.colors.text} />
      </Pressable>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.lg }}>
        <SuccessIllustration />
        <View style={{ width: "78%", gap: theme.spacing.sm }}>
          <Text variant="page" weight="bold" color={theme.colors.successTitle} center testID="success-title">
            {copy.title}
          </Text>
          {message ? (
            <Text variant="fine" color={theme.colors.textLight} center testID="success-message">
              {message}
            </Text>
          ) : null}
        </View>
        {copy.action ? <Button testID="success-action" title={copy.action} onPress={view} style={{ width: "78%", minHeight: 52, borderRadius: 26 }} /> : null}
      </View>
    </View>
  );
};

export default CarePlanSuccess;
