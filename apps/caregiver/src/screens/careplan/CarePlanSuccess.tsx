import React from "react";
import { View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import Box from "@/src/components/ui/box";
import Button from "@/src/components/ui/button";
import { Done } from "@/src/components/ui/done";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "CarePlanSuccess">;

const COPY = {
  created: {
    title: "Care plan created",
    message: "The plan is saved for this client. Every caregiver on a visit with them can now see it.",
    action: "View care plan",
  },
  goal_added: {
    title: "New Care Goal has been added",
    message: "The goal is now part of the client's care plan.",
    action: "View Care Goal",
  },
} as const;

/** The shared success page ("plan created", "goal added"), built on the same `Done` badge as the account-created page. */
const CarePlanSuccess: React.FC<Props> = ({ route }) => {
  const { kind, planId } = route.params;
  const { navigation } = useNavigation();
  const copy = COPY[kind];

  // A new plan replaces this page with its details; a new goal returns to the details underneath.
  const view = () => (kind === "created" ? navigation.replace("CarePlanDetails", { planId }) : navigation.goBack());

  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <Box flex={1} center style={{ gap: theme.spacing.lg }}>
        <Done />
        <Text variant="h2" weight="bold" color={theme.colors.primary} center testID="success-title">
          {copy.title}
        </Text>
        <Text variant="body" color={theme.colors.textLight} center>
          {copy.message}
        </Text>
        <Button testID="success-action" title={copy.action} onPress={view} style={{ width: "100%" }} />
      </Box>
    </View>
  );
};

export default CarePlanSuccess;
