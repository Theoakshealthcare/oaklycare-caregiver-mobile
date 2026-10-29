import React, { useEffect } from "react";
import { RefreshControl, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { Card, CarePlanNotice } from "@/src/components/careplan/parts";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  NOT_AVAILABLE_HINT,
  NOT_AVAILABLE_TITLE,
  dayOfPlan,
  formatPlanDate,
  formatStamp,
  isNoAccess,
  progressHeadline,
  shortDate,
} from "@/src/careplan/carePlanModel";
import { useCarePlanProgress } from "@/src/hooks/useCarePlanTasks";
import useNavigation from "@/src/hooks/use-navigation";
import { queryKeys } from "@/src/api/keys";
import { useQueryClient } from "@tanstack/react-query";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { CarePlanProgress as Progress } from "@/src/services/carePlans.service";

type Props = StackScreenProps<ScreenParamLists, "CarePlanProgress">;

const Bar: React.FC<{ percent: number; testID?: string }> = ({ percent, testID }) => (
  <View testID={testID} style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.border, overflow: "hidden" }}>
    <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: 8, backgroundColor: theme.colors.primary }} />
  </View>
);

const Row: React.FC<{ label: string; value: string; testID?: string }> = ({ label, value, testID }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md }}>
    <Text variant="small" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="small" weight="medium" testID={testID}>
      {value}
    </Text>
  </View>
);

const Body: React.FC<{ progress: Progress }> = ({ progress }) => {
  const measured = progress.overall_percent !== null && progress.overall_percent !== undefined;
  return (
    <View style={{ gap: theme.spacing.md }}>
      <Card testID="progress-overall">
        <Text variant="h2" weight="bold" color={measured ? theme.colors.primary : theme.colors.textLight} testID="progress-headline">
          {progressHeadline(progress)}
        </Text>
        {measured ? <Bar percent={progress.overall_percent as number} testID="progress-bar" /> : null}
        <Text variant="small" testID="progress-counts">
          {`${progress.completed} of ${progress.scheduled} tasks done on ${progress.visit_days} visit ${progress.visit_days === 1 ? "day" : "days"}`}
        </Text>
        <Text variant="caption" color={theme.colors.textLight} testID="progress-explain">
          Only days with a visit for this client are counted, so a day without a visit never lowers the percentage.
        </Text>
      </Card>

      <Card testID="progress-plan">
        <Row label="Plan" value={dayOfPlan(progress)} testID="progress-day" />
        <Row label="Next review" value={progress.review_due_on ? formatPlanDate(progress.review_due_on) : "No review date"} testID="progress-review" />
        <Row label="Last note" value={progress.last_observation_at ? formatStamp(progress.last_observation_at) : "No notes yet"} testID="progress-last-note" />
      </Card>

      <Card testID="progress-goals">
        <Text variant="body" weight="bold">
          Care goals
        </Text>
        <Row label="Active" value={String(progress.goals.active)} testID="progress-goals-active" />
        <Row label="Achieved" value={String(progress.goals.achieved)} testID="progress-goals-achieved" />
        <Row label="Discontinued" value={String(progress.goals.discontinued)} testID="progress-goals-discontinued" />
      </Card>

      <Card testID="progress-days">
        <Text variant="body" weight="bold">
          Recent visit days
        </Text>
        {progress.by_day.length === 0 ? (
          <Text variant="small" color={theme.colors.textLight} testID="progress-days-empty">
            No visit days yet.
          </Text>
        ) : (
          progress.by_day.map((d) => (
            <View key={d.date} testID={`progress-day-${d.date}`} style={{ gap: theme.spacing.xs }}>
              <Row label={shortDate(d.date)} value={`${d.completed} of ${d.scheduled}`} />
              <Bar percent={d.scheduled > 0 ? Math.round((d.completed / d.scheduled) * 100) : 0} />
            </View>
          ))
        )}
      </Card>
    </View>
  );
};

/** View Progress for one plan: percent over visit days, day N of M, review date, goal counts, the last visit days. */
const CarePlanProgress: React.FC<Props> = ({ route }) => {
  const { planId } = route.params;
  const { navigation } = useNavigation();
  const client = useQueryClient();
  const query = useCarePlanProgress(planId);
  const noAccess = query.isError && isNoAccess(query.error);

  // Access ended (the visit completed): do not keep the client's numbers in memory.
  useEffect(() => {
    if (noAccess) client.removeQueries({ queryKey: queryKeys.carePlanProgress(planId) });
  }, [noAccess, client, planId]);

  if (noAccess) {
    return <CarePlanNotice title={NOT_AVAILABLE_TITLE} message={NOT_AVAILABLE_HINT} actionLabel="Go back" onAction={() => navigation.goBack()} />;
  }
  return (
    <ScreenShell
      title="View progress"
      subtitle={route.params.clientName}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingState testID="progress-loading" />
      ) : (
        <Body progress={query.data} />
      )}
    </ScreenShell>
  );
};

export default CarePlanProgress;
