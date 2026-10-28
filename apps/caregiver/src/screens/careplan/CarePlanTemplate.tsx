import React from "react";
import { View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { Card, RiskBadge } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  NOT_REVIEWED_NOTE,
  SLOTS,
  daysLabel,
  frequencyLabel,
  planLength,
} from "@/src/careplan/carePlanModel";
import { usePlanTemplate } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "CarePlanTemplate">;

const Heading: React.FC<{ children: string }> = ({ children }) => (
  <Text variant="h3" weight="bold" style={{ marginTop: theme.spacing.md }}>
    {children}
  </Text>
);

/** A seeded template, read-only. "Use template" goes to the client picker, or straight to the form from a client's profile. */
const CarePlanTemplate: React.FC<Props> = ({ route }) => {
  const { templateId, bookingId } = route.params;
  const { navigation } = useNavigation();
  const query = usePlanTemplate(templateId);

  if (query.isError && !query.data) {
    return (
      <ScreenShell title="Template">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </ScreenShell>
    );
  }
  if (!query.data) {
    return (
      <ScreenShell title="Template">
        <LoadingState testID="template-loading" />
      </ScreenShell>
    );
  }
  const template = query.data;

  const use = () =>
    bookingId
      ? navigation.navigate("CreateCarePlan", { bookingId, templateId })
      : navigation.navigate("CarePlanClients", { templateId });

  return (
    <ScreenShell title={template.name} subtitle={template.summary}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="body" testID="template-program">
          {`${planLength(template.duration_days)} program${template.review_every_days ? `, review every ${template.review_every_days} days` : ""}`}
        </Text>
        <RiskBadge risk={template.default_risk_level} />
        {template.clinical_review_status === "pending" ? (
          <Text variant="small" color={theme.colors.warningText} testID="template-not-reviewed">
            {NOT_REVIEWED_NOTE}
          </Text>
        ) : null}

        <Heading>Care goals</Heading>
        <Card testID="template-goals">
          {template.goals.map((goal, i) => (
            <View key={`${goal.title}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="body">{goal.title}</Text>
                {goal.target ? (
                  <Text variant="caption" color={theme.colors.textLight}>
                    {goal.target}
                  </Text>
                ) : null}
              </View>
              <Text variant="small" color={theme.colors.textLight}>
                {frequencyLabel(goal.frequency)}
              </Text>
            </View>
          ))}
        </Card>

        <Heading>Daily tasks</Heading>
        <Card testID="template-tasks">
          {SLOTS.map((slot) => {
            const tasks = template.tasks.filter((t) => t.time_slot === slot.value);
            if (tasks.length === 0) return null;
            return (
              <View key={slot.value} style={{ gap: theme.spacing.xs }}>
                <Text variant="small" weight="bold" color={theme.colors.primary}>
                  {slot.label}
                </Text>
                {tasks.map((task, i) => (
                  <Text key={`${task.title}-${i}`} variant="body">
                    {`${task.title}${task.time_of_day ? `, ${task.time_of_day}` : ""} · ${daysLabel(task.days_of_week)}`}
                  </Text>
                ))}
              </View>
            );
          })}
        </Card>

        {template.special_instructions.length > 0 ? (
          <>
            <Heading>Special instructions</Heading>
            <Card testID="template-instructions">
              {template.special_instructions.map((line, i) => (
                <Text key={`${line}-${i}`} variant="body">
                  {line}
                </Text>
              ))}
            </Card>
          </>
        ) : null}

        <Text variant="small" color={theme.colors.textLight} style={{ marginTop: theme.spacing.md }}>
          Edit anything after you create the plan.
        </Text>
        <Button testID="use-template" title="Use template" onPress={use} />
      </View>
    </ScreenShell>
  );
};

export default CarePlanTemplate;
