import React, { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import { messageForError } from "@/src/api/errors";
import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import EditPlanSheet from "@/src/components/careplan/EditPlanSheet";
import GoalModal from "@/src/components/careplan/GoalModal";
import ListEditModal, { type ListField } from "@/src/components/careplan/ListEditModal";
import { Accordion, Card, CarePlanNotice, FieldHint, RiskBadge } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  CONFLICT_HINT,
  NOT_AVAILABLE_HINT,
  NOT_AVAILABLE_TITLE,
  ONLY_NURSES_HINT,
  PLAN_STATUS_LABEL,
  ageAndSex,
  conflictPlan,
  errorCode,
  formatPlanDate,
  frequencyLabel,
  isNoAccess,
  planLength,
  reviewText,
  visibleGoals,
} from "@/src/careplan/carePlanModel";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { useClientProfile } from "@/src/hooks/queries";
import { useCarePlan, useEditGoal } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { CarePlan, CarePlanGoal } from "@/src/services/carePlans.service";

type Props = StackScreenProps<ScreenParamLists, "CarePlanDetails">;

const Line: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View>
    <Text variant="caption" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="body">{value}</Text>
  </View>
);

const EditIcon: React.FC<{ onPress: () => void; label: string; testID: string }> = ({ onPress, label, testID }) => (
  <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={{ padding: theme.spacing.xs }}>
    <Feather name="edit-2" size={18} color={theme.colors.primary} />
  </Pressable>
);

/** The client's own record, from the client profile (its allergies are the patient's, not the care team's). */
const ClientSection: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  const query = useClientProfile(bookingId);
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <LoadingState testID="details-client-loading" />;
  const profile = query.data;
  const history = profile.medical_history;
  const contact = profile.emergency_contact;
  const subtitle = ageAndSex(profile);
  return (
    <View testID="details-client" style={{ gap: theme.spacing.sm }}>
      <Line label="Name" value={profile.full_name} />
      {subtitle ? <Line label="Age and sex" value={subtitle} /> : null}
      {history?.medical_conditions ? <Line label="Conditions on the client's record" value={history.medical_conditions} /> : null}
      {history?.allergies ? <Line label="Allergies on the client's record" value={history.allergies} /> : null}
      {history?.blood_group ? <Line label="Blood group" value={history.blood_group} /> : null}
      {contact ? <Line label="Emergency contact" value={[contact.name, contact.relationship, contact.phone].filter(Boolean).join(", ")} /> : null}
      {!history && !contact ? (
        <Text variant="small" color={theme.colors.textLight}>
          No medical history or emergency contact is on file for this client.
        </Text>
      ) : null}
    </View>
  );
};

const GoalRow: React.FC<{
  goal: CarePlanGoal;
  plan: CarePlan;
  canEdit: boolean;
  onEdit: () => void;
  onError: (error: unknown) => void;
  onChanged: () => void;
}> = ({ goal, plan, canEdit, onEdit, onError, onChanged }) => {
  const [menu, setMenu] = useState(false);
  const edit = useEditGoal(plan.id);

  const setStatus = (status: CarePlanGoal["status"]) => {
    setMenu(false);
    edit.mutate({ goalId: goal.id, expectedVersion: plan.version, changes: { status } }, { onError, onSuccess: onChanged });
  };
  const discontinue = () =>
    Alert.alert("Discontinue this goal?", "It is removed from the plan's goals. The history is kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Discontinue", style: "destructive", onPress: () => setStatus("discontinued") },
    ]);

  return (
    <View testID={`goal-${goal.id}`} style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="body">{goal.title}</Text>
          {goal.target ? (
            <Text variant="caption" color={theme.colors.textLight}>
              {goal.target}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text variant="small" color={theme.colors.textLight}>
            {frequencyLabel(goal.frequency)}
          </Text>
          {goal.status === "achieved" ? (
            <Text variant="caption" weight="medium" color={theme.colors.primary} testID={`goal-achieved-${goal.id}`}>
              Achieved
            </Text>
          ) : null}
        </View>
        {canEdit ? (
          <Pressable
            testID={`goal-menu-${goal.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Goal options for ${goal.title}`}
            onPress={() => setMenu((v) => !v)}
            hitSlop={8}
          >
            <Feather name="more-vertical" size={20} color={theme.colors.textLight} />
          </Pressable>
        ) : null}
      </View>
      {menu ? (
        <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
          <Button testID={`goal-edit-${goal.id}`} title="Edit" variant="outline" onPress={() => { setMenu(false); onEdit(); }} />
          <Button
            testID={`goal-status-${goal.id}`}
            title={goal.status === "achieved" ? "Mark active" : "Mark achieved"}
            variant="outline"
            onPress={() => setStatus(goal.status === "achieved" ? "active" : "achieved")}
            loading={edit.isPending}
          />
          <Button testID={`goal-discontinue-${goal.id}`} title="Discontinue" variant="outline" onPress={discontinue} />
        </View>
      ) : null}
    </View>
  );
};

/** One care plan: header, then the sections the nurse and the other caregivers read (client, goals, allergies and instructions). */
const CarePlanDetails: React.FC<Props> = ({ route }) => {
  const { planId } = route.params;
  const { navigation } = useNavigation();
  const client = useQueryClient();
  const [lostAccess, setLostAccess] = useState(false);
  const query = useCarePlan(planId, !lostAccess);
  const [sheet, setSheet] = useState<null | { kind: "plan" } | { kind: "goal"; goal?: CarePlanGoal } | { kind: "list"; field: ListField }>(null);
  const [goalError, setGoalError] = useState<string | null>(null);

  // Access ended mid-session: do not keep the client's plan in memory any longer than needed.
  useEffect(() => {
    if (lostAccess) client.removeQueries({ queryKey: queryKeys.carePlan(planId) });
  }, [lostAccess, client, planId]);

  const unavailable = (
    <CarePlanNotice title={NOT_AVAILABLE_TITLE} message={NOT_AVAILABLE_HINT} actionLabel="Go back" onAction={() => navigation.goBack()} />
  );
  if (lostAccess || (query.isError && isNoAccess(query.error))) return unavailable;
  if (query.isError && !query.data) {
    return (
      <ScreenShell title="Care plan details">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </ScreenShell>
    );
  }
  if (!query.data) {
    return (
      <ScreenShell title="Care plan details">
        <LoadingState testID="details-loading" />
      </ScreenShell>
    );
  }

  const plan = query.data;
  const canEdit = plan.capabilities.can_edit_plan;
  const goals = visibleGoals(plan);
  const subtitle = ageAndSex(plan.client);
  const readOnly = plan.status !== "active";
  // A plan completed or archived elsewhere reloads as read-only: an open sheet is dropped with its controls.
  const sheetOpen = canEdit ? sheet : null;

  const goalFailed = (error: unknown) => {
    if (isNoAccess(error)) return setLostAccess(true);
    if (conflictPlan(error)) setGoalError(CONFLICT_HINT);
    else if (errorCode(error) === "not_a_nurse") setGoalError(ONLY_NURSES_HINT);
    else setGoalError(messageForError(error));
  };

  return (
    <>
      <ScreenShell
        title="Care plan details"
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      >
        <View style={{ gap: theme.spacing.md }}>
          <Card testID="details-header">
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="h3" weight="bold" testID="details-client-name">
                  {plan.client.full_name}
                </Text>
                {subtitle ? (
                  <Text variant="small" color={theme.colors.textLight}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {canEdit ? <EditIcon testID="details-edit" label="Edit care plan" onPress={() => setSheet({ kind: "plan" })} /> : null}
            </View>
            <Text variant="small" weight="medium" color={plan.status === "active" ? theme.colors.primary : theme.colors.textLight} testID="details-status">
              {PLAN_STATUS_LABEL[plan.status]}
            </Text>
            <Line label="Diagnosis" value={plan.diagnosis} />
            <RiskBadge risk={plan.risk_level} testID="details-risk" />
            <Line label="Plan" value={`Starts ${formatPlanDate(plan.start_date)} · ${planLength(plan.duration_days)}`} />
            <Text variant="small" color={theme.colors.textLight} testID="details-review">
              {reviewText(plan)}
            </Text>
            <Text variant="small" color={theme.colors.textLight} testID="details-author">
              {`Created by ${plan.author.name}${plan.template ? ` · ${plan.template.name} template` : ""}`}
            </Text>
          </Card>

          {readOnly ? (
            <Text variant="small" color={theme.colors.warningText} testID="details-read-only">
              {`This plan is ${plan.status} and can't be changed.`}
            </Text>
          ) : null}

          <Accordion testID="section-client" title="Client profile">
            <ClientSection bookingId={plan.booking_id} />
          </Accordion>

          <Accordion testID="section-goals" title="Care goals" defaultOpen>
            {goals.length === 0 ? (
              <Text variant="small" color={theme.colors.textLight} testID="goals-empty">
                No care goals yet.
              </Text>
            ) : (
              goals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  plan={plan}
                  canEdit={canEdit}
                  onEdit={() => setSheet({ kind: "goal", goal })}
                  onError={goalFailed}
                  onChanged={() => setGoalError(null)}
                />
              ))
            )}
            {goalError ? <FieldHint text={goalError} testID="goals-error" /> : null}
            {canEdit ? (
              <Button
                testID="goal-add"
                title="Add goal"
                variant="outline"
                onPress={() => {
                  setGoalError(null);
                  setSheet({ kind: "goal" });
                }}
              />
            ) : null}
          </Accordion>

          <Accordion testID="section-notes" title="Allergies and special instructions">
            <View testID="details-allergies" style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text variant="small" weight="bold">
                  Allergies (care team)
                </Text>
                {canEdit ? <EditIcon testID="edit-allergies" label="Edit allergies" onPress={() => setSheet({ kind: "list", field: "allergies" })} /> : null}
              </View>
              {plan.allergies.length === 0 ? (
                <Text variant="small" color={theme.colors.textLight}>
                  None recorded.
                </Text>
              ) : (
                plan.allergies.map((line, i) => (
                  <Text key={`${line}-${i}`} variant="body">
                    {line}
                  </Text>
                ))
              )}
            </View>
            <View testID="details-instructions" style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text variant="small" weight="bold">
                  Special instructions
                </Text>
                {canEdit ? (
                  <EditIcon testID="edit-instructions" label="Edit special instructions" onPress={() => setSheet({ kind: "list", field: "special_instructions" })} />
                ) : null}
              </View>
              {plan.special_instructions.length === 0 ? (
                <Text variant="small" color={theme.colors.textLight}>
                  None recorded.
                </Text>
              ) : (
                plan.special_instructions.map((line, i) => (
                  <Text key={`${line}-${i}`} variant="body">
                    {line}
                  </Text>
                ))
              )}
            </View>
          </Accordion>
        </View>
      </ScreenShell>

      {sheetOpen?.kind === "plan" ? <EditPlanSheet plan={plan} onClose={() => setSheet(null)} onNoAccess={() => setLostAccess(true)} /> : null}
      {sheetOpen?.kind === "goal" ? (
        <GoalModal
          plan={plan}
          goal={sheetOpen.goal}
          onClose={() => setSheet(null)}
          onNoAccess={() => setLostAccess(true)}
          onSaved={(kind) => {
            setSheet(null);
            if (kind === "added") navigation.navigate("CarePlanSuccess", { kind: "goal_added", planId: plan.id });
          }}
        />
      ) : null}
      {sheetOpen?.kind === "list" ? (
        <ListEditModal plan={plan} field={sheetOpen.field} onClose={() => setSheet(null)} onNoAccess={() => setLostAccess(true)} />
      ) : null}
    </>
  );
};

export default CarePlanDetails;
