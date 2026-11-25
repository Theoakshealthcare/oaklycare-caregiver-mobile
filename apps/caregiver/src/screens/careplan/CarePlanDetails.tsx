import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import { messageForError } from "@/src/api/errors";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import DailyTasks from "@/src/components/careplan/DailyTasks";
import EditPlanSheet from "@/src/components/careplan/EditPlanSheet";
import GoalModal from "@/src/components/careplan/GoalModal";
import ListEditModal, { type ListField } from "@/src/components/careplan/ListEditModal";
import MedicationModal from "@/src/components/careplan/MedicationModal";
import MedicationsSection from "@/src/components/careplan/MedicationsSection";
import NotesSection from "@/src/components/careplan/NotesSection";
import TaskModal from "@/src/components/careplan/TaskModal";
import PlanScreen from "@/src/components/careplan/PlanScreen";
import { Accordion, AddLink, CarePlanNotice, FieldHint, RiskBadge } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  CONFLICT_HINT,
  NOT_AVAILABLE_HINT,
  NOT_AVAILABLE_TITLE,
  ONLY_NURSES_HINT,
  PLAN_STATUS_LABEL,
  conflictPlan,
  errorCode,
  formatPlanDate,
  frequencyLabel,
  isNoAccess,
  planDuration,
  reviewText,
  sexAndAge,
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

/** A grey caption over a bold value: the Client Profile lines of the Figma frame. */
const Line: React.FC<{ label: string; value: string; testID?: string }> = ({ label, value, testID }) => (
  <View testID={testID} style={{ gap: 2 }}>
    <Text variant="caption" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="small" weight="bold">
      {value}
    </Text>
  </View>
);

/** "Edit Plan" (teal, with the pencil-square) in the header; a small pencil on the lists inside the sections. */
const EditIcon: React.FC<{ onPress: () => void; label: string; testID: string; text?: string }> = ({ onPress, label, testID, text }) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    hitSlop={8}
    style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, padding: theme.spacing.xs }}
  >
    <Feather name="edit" size={text ? 16 : 18} color={theme.colors.primary} />
    {text ? (
      <Text variant="caption" color={theme.colors.primary}>
        {text}
      </Text>
    ) : null}
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
  return (
    <View testID="details-client" style={{ gap: theme.spacing.md }}>
      {contact ? (
        <View style={{ gap: 2 }}>
          <Text variant="caption" color={theme.colors.textLight}>
            Primary Contact
          </Text>
          <Text variant="small" weight="bold">
            {[contact.name, contact.relationship ? `(${contact.relationship})` : null].filter(Boolean).join(" ")}
          </Text>
          {contact.phone ? (
            <Text variant="caption" weight="medium" color={theme.colors.primary}>
              {contact.phone}
            </Text>
          ) : null}
        </View>
      ) : null}
      {history?.medical_conditions ? <Line label="Conditions on the client's record" value={history.medical_conditions} /> : null}
      {history?.allergies ? <Line label="Allergies on the client's record" value={history.allergies} /> : null}
      {history?.blood_group ? <Line label="Blood group" value={history.blood_group} /> : null}
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
          <Text variant="small" weight="bold">
            {goal.title}
          </Text>
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

/** One care plan: header, then the sections the nurse and the other caregivers read (client, goals, medications, tasks, notes, allergies and instructions). */
const CarePlanDetails: React.FC<Props> = ({ route }) => {
  const { planId, from } = route.params;
  // Coming from the clock-out prompt: the tasks and the notes are what the caregiver came to finish.
  const finishing = from === "clock_out";
  const { navigation } = useNavigation();
  const client = useQueryClient();
  const [lostAccess, setLostAccess] = useState(false);
  const query = useCarePlan(planId, !lostAccess);
  const [sheet, setSheet] = useState<
    null | { kind: "plan" } | { kind: "goal"; goal?: CarePlanGoal } | { kind: "list"; field: ListField } | { kind: "task" } | { kind: "medication" }
  >(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const onNoAccess = useCallback(() => setLostAccess(true), []);

  // Access ended mid-session: do not keep the client's plan, tasks, notes or progress in memory any longer than needed.
  useEffect(() => {
    if (!lostAccess) return;
    client.removeQueries({ queryKey: queryKeys.carePlan(planId) });
    client.removeQueries({ queryKey: queryKeys.allCarePlanTasks(planId) });
    client.removeQueries({ queryKey: queryKeys.allCarePlanNotes(planId) });
    client.removeQueries({ queryKey: queryKeys.carePlanProgress(planId) });
  }, [lostAccess, client, planId]);

  const unavailable = (
    <CarePlanNotice title={NOT_AVAILABLE_TITLE} message={NOT_AVAILABLE_HINT} actionLabel="Go back" onAction={() => navigation.goBack()} />
  );
  if (lostAccess || (query.isError && isNoAccess(query.error))) return unavailable;
  if (query.isError && !query.data) {
    return (
      <PlanScreen title="Care Plan Details">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </PlanScreen>
    );
  }
  if (!query.data) {
    return (
      <PlanScreen title="Care Plan Details">
        <LoadingState testID="details-loading" />
      </PlanScreen>
    );
  }

  const plan = query.data;
  const canEdit = plan.capabilities.can_edit_plan;
  const goals = visibleGoals(plan);
  const subtitle = sexAndAge(plan.client);
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
      <PlanScreen
        title="Care Plan Details"
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      >
        <View testID="details-header" style={{ backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <View
              style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" }}
            >
              <Text variant="h2" weight="bold" color={theme.colors.primary}>
                {plan.client.full_name.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="body" weight="bold" testID="details-client-name">
                {plan.client.full_name}
              </Text>
              {subtitle ? (
                <Text variant="caption" color={theme.colors.textLight}>
                  {subtitle}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View
                  style={{ paddingVertical: 2, paddingHorizontal: theme.spacing.sm, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.primaryLight }}
                >
                  <Text variant="caption" weight="bold" color={plan.status === "active" ? theme.colors.primary : theme.colors.textLight} testID="details-status">
                    {PLAN_STATUS_LABEL[plan.status]}
                  </Text>
                </View>
                {canEdit ? <EditIcon testID="details-edit" label="Edit care plan" text="Edit Plan" onPress={() => setSheet({ kind: "plan" })} /> : null}
              </View>
            </View>
          </View>
        </View>

        {readOnly ? (
          <Text variant="small" color={theme.colors.warningText} testID="details-read-only">
            {`This plan is ${plan.status} and can't be changed.`}
          </Text>
        ) : null}

        <Accordion testID="section-client" title="Client Profile">
          <Line label="Diagnosis" value={plan.diagnosis} testID="details-diagnosis" />
          <RiskBadge risk={plan.risk_level} testID="details-risk" />
          <ClientSection bookingId={plan.booking_id} />
          <Line label="Plan Duration" value={planDuration(plan)} testID="details-duration" />
          <Line label="Plan Starts" value={formatPlanDate(plan.start_date)} />
          <Text variant="small" color={theme.colors.textLight} testID="details-review">
            {reviewText(plan)}
          </Text>
          <Line label="Created By" value={`${plan.author.name}${plan.template ? ` · ${plan.template.name} template` : ""}`} testID="details-author" />
          <Button
            testID="details-progress"
            title="View Progress"
            variant="outline"
            onPress={() => navigation.navigate("CarePlanProgress", { planId: plan.id, clientName: plan.client.full_name })}
          />
        </Accordion>

        <Accordion testID="section-goals" title="Care Goals">
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
            <AddLink
              testID="goal-add"
              label="Add New Care Goal"
              onPress={() => {
                setGoalError(null);
                setSheet({ kind: "goal" });
              }}
            />
          ) : null}
        </Accordion>

        <MedicationsSection plan={plan} onAdd={plan.capabilities.can_edit_medications && canEdit ? () => setSheet({ kind: "medication" }) : undefined} />

        <Accordion testID="section-tasks" title="Daily Care Task" defaultOpen={finishing} keepMounted>
          <DailyTasks plan={plan} onNoAccess={onNoAccess} onAddTask={canEdit ? () => setSheet({ kind: "task" }) : undefined} />
        </Accordion>

        <Accordion testID="section-notes" title="Allergies & Special Instructions" keepMounted>
          <View testID="details-allergies" style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text variant="small" weight="bold">
                Allergies
              </Text>
              {canEdit ? <EditIcon testID="edit-allergies" label="Edit allergies" onPress={() => setSheet({ kind: "list", field: "allergies" })} /> : null}
            </View>
            {plan.allergies.length === 0 ? (
              <Text variant="small" color={theme.colors.textLight}>
                None recorded.
              </Text>
            ) : (
              plan.allergies.map((line, i) => (
                <Text key={`${line}-${i}`} variant="small" color={theme.colors.textLight}>
                  {line}
                </Text>
              ))
            )}
          </View>
          <View testID="details-instructions" style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text variant="small" weight="bold">
                Special Instructions
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
                <Text key={`${line}-${i}`} variant="small" color={theme.colors.textLight}>
                  {line}
                </Text>
              ))
            )}
          </View>
          <View testID="details-special-notes" style={{ gap: theme.spacing.xs }}>
            <Text variant="small" weight="bold">
              Special Notes
            </Text>
            <NotesSection plan={plan} category="special_note" onNoAccess={onNoAccess} />
          </View>
        </Accordion>

        <Accordion testID="section-observations" title="Notes & Observations" defaultOpen={finishing} keepMounted>
          <NotesSection plan={plan} category="observation" onNoAccess={onNoAccess} />
        </Accordion>
      </PlanScreen>

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
      {sheetOpen?.kind === "task" ? (
        <TaskModal
          plan={plan}
          onClose={() => setSheet(null)}
          onNoAccess={onNoAccess}
          onSaved={() => {
            setSheet(null);
            navigation.navigate("CarePlanSuccess", { kind: "task_added", planId: plan.id });
          }}
        />
      ) : null}
      {sheetOpen?.kind === "medication" ? (
        <MedicationModal
          plan={plan}
          onClose={() => setSheet(null)}
          onNoAccess={onNoAccess}
          onSaved={() => {
            setSheet(null);
            navigation.navigate("CarePlanSuccess", { kind: "medication_added", planId: plan.id });
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
