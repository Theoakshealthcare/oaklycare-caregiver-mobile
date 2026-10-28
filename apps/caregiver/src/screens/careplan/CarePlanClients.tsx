import React from "react";
import { Pressable, RefreshControl, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import ScreenShell from "@/src/components/account/ScreenShell";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { Card } from "@/src/components/careplan/parts";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { ONLY_NURSES_HINT, ageAndSex, errorCode } from "@/src/careplan/carePlanModel";
import { usePlanCandidates, usePlanTemplate } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { formatVisitTime } from "@/src/utils/dates";

type Props = StackScreenProps<ScreenParamLists, "CarePlanClients">;

const STATUS_LABEL: Record<string, string> = { accepted: "Accepted", en_route: "On the way", in_progress: "In progress" };

/** Step two of "Use template" and of "Create New Care Plan": which client the plan is for. */
const CarePlanClients: React.FC<Props> = ({ route }) => {
  const templateId = route.params?.templateId;
  const { navigation } = useNavigation();
  const candidates = usePlanCandidates();
  const template = usePlanTemplate(templateId);

  const content = () => {
    if (candidates.isError && !candidates.data) {
      return errorCode(candidates.error) === "not_a_nurse" ? (
        <EmptyState icon="lock" title="Only nurses can create plans" hint={ONLY_NURSES_HINT} />
      ) : (
        <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
      );
    }
    if (!candidates.data) return <LoadingState testID="clients-loading" />;
    if (candidates.data.items.length === 0) {
      return (
        <EmptyState
          icon="users"
          title="No clients waiting for a plan"
          hint="Clients on your accepted, upcoming or in-progress visits who already have an active plan are not listed."
        />
      );
    }
    return (
      <View style={{ gap: theme.spacing.md }}>
        {candidates.data.items.map((c) => {
          const subtitle = ageAndSex(c.client);
          return (
            <Pressable
              key={c.booking_id}
              testID={`client-${c.booking_id}`}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate("CreateCarePlan", { bookingId: c.booking_id, templateId, clientName: c.client.full_name })
              }
            >
              <Card>
                <Text variant="body" weight="bold">
                  {c.client.full_name}
                </Text>
                {subtitle ? (
                  <Text variant="small" color={theme.colors.textLight}>
                    {subtitle}
                  </Text>
                ) : null}
                <Text variant="caption">{`${STATUS_LABEL[c.booking_status] ?? c.booking_status} · ${formatVisitTime(c.scheduled_date)}`}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <ScreenShell
      title="Choose a client"
      subtitle={template.data ? `Care plan from the ${template.data.name} template` : "Who is the care plan for?"}
      refreshControl={<RefreshControl refreshing={candidates.isRefetching} onRefresh={() => void candidates.refetch()} />}
    >
      {content()}
    </ScreenShell>
  );
};

export default CarePlanClients;
