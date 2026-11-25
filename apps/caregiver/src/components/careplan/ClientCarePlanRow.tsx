import React from "react";
import { View } from "react-native";

import { Card, RiskBadge } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  ASK_THE_NURSE_HINT,
  NOT_AVAILABLE_HINT,
  NOT_IDENTIFIED_HINT,
  isNoAccess,
  planLength,
} from "@/src/careplan/carePlanModel";
import { usePlanTemplates, useVisitCarePlan } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";

/**
 * The "Care plan" row of the client profile. A 200 with `plan: null` means "no plan yet"; a 404 means
 * this visit no longer gives access. Create / Open follow the server's `can_author`, never the nurse skill.
 */
const ClientCarePlanRow: React.FC<{ bookingId: string; clientName?: string }> = ({ bookingId, clientName }) => {
  const { navigation } = useNavigation();
  const query = useVisitCarePlan(bookingId);
  // A caregiver who is not a nurse may start a plan only from a template flagged for them (Elderly): the server lists just those.
  const caregiverOnly = query.data?.author_scope === "caregiver_templates" && !query.data.plan && query.data.subject_ready;
  const templates = usePlanTemplates(caregiverOnly === true);

  const body = () => {
    if (query.isError) {
      return (
        <>
          <Text variant="small" color={theme.colors.textLight} testID="care-plan-row-unavailable">
            {isNoAccess(query.error) ? NOT_AVAILABLE_HINT : "We couldn't load the care plan."}
          </Text>
          {!isNoAccess(query.error) ? <Button title="Try again" variant="outline" onPress={() => void query.refetch()} /> : null}
        </>
      );
    }
    if (!query.data) {
      return (
        <Text variant="small" color={theme.colors.textLight} testID="care-plan-row-loading">
          Loading the care plan...
        </Text>
      );
    }
    const { plan, subject_ready: ready, can_author: canAuthor } = query.data;
    if (plan) {
      return (
        <>
          <Text variant="body" testID="care-plan-row-diagnosis">
            {plan.diagnosis}
          </Text>
          <RiskBadge risk={plan.risk_level} />
          <Text variant="caption" color={theme.colors.textLight}>
            {`${planLength(plan.duration_days)} · ${plan.goal_count} ${plan.goal_count === 1 ? "goal" : "goals"}`}
          </Text>
          <Button testID="care-plan-open" title="Open care plan" onPress={() => navigation.navigate("CarePlanDetails", { planId: plan.id })} />
        </>
      );
    }
    if (!ready) {
      return (
        <Text variant="small" color={theme.colors.textLight} testID="care-plan-row-not-identified">
          {NOT_IDENTIFIED_HINT}
        </Text>
      );
    }
    return (
      <>
        <Text variant="body" weight="bold">
          No care plan yet
        </Text>
        {canAuthor ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              testID="care-plan-create"
              title="Create care plan"
              onPress={() => navigation.navigate("CreateCarePlan", { bookingId, clientName })}
            />
            <Button
              testID="care-plan-use-template"
              title="Use a template"
              variant="outline"
              onPress={() => navigation.navigate("CarePlans", { tab: "templates", bookingId })}
            />
          </View>
        ) : templates.data && templates.data.items.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            {templates.data.items.map((template) => (
              <Button
                key={template.id}
                testID={`care-plan-use-${template.key}`}
                title={`Use the ${template.name} template`}
                onPress={() => navigation.navigate("CarePlanTemplate", { templateId: template.id, bookingId })}
              />
            ))}
            <Text variant="small" color={theme.colors.textLight} testID="care-plan-row-ask">
              {ASK_THE_NURSE_HINT}
            </Text>
          </View>
        ) : (
          <Text variant="small" color={theme.colors.textLight} testID="care-plan-row-ask">
            {ASK_THE_NURSE_HINT}
          </Text>
        )}
      </>
    );
  };

  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <Text variant="body" weight="bold" color={theme.colors.sectionTitle} style={{ marginBottom: theme.spacing.sm }}>
        Care Plan
      </Text>
      <Card testID="care-plan-row">{body()}</Card>
    </View>
  );
};

export default ClientCarePlanRow;
