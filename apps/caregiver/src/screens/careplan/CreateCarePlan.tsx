import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import { messageForError } from "@/src/api/errors";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import PlanScreen from "@/src/components/careplan/PlanScreen";
import { AddLink, CarePlanNotice, Card, Chip, FieldHint } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import DateField from "@/src/components/ui/date-field";
import Input from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  DAILY,
  FREQUENCIES,
  NOT_AVAILABLE_HINT,
  NOT_AVAILABLE_TITLE,
  NOT_IDENTIFIED_HINT,
  ONLY_NURSES_HINT,
  RISKS,
  SLOTS,
  WEEKDAYS,
  WEEKENDS,
  buildCreateBody,
  daysLabel,
  emptyDraft,
  errorCode,
  existingPlanId,
  frequencyLabel,
  isNoAccess,
  slotLabel,
  templateToDraft,
  validateDraft,
  validateGoal,
  validationField,
  type DraftErrors,
  type DraftTask,
  type PlanDraft,
  type TimeSlot,
} from "@/src/careplan/carePlanModel";
import { useCreateCarePlan, usePlanTemplate } from "@/src/hooks/useCarePlans";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { GoalFrequency } from "@/src/services/carePlans.service";

type Props = StackScreenProps<ScreenParamLists, "CreateCarePlan">;

const SERVER_FIELD: Record<string, keyof DraftErrors> = {
  diagnosis: "diagnosis",
  risk_level: "risk",
  start_date: "startDate",
  duration_days: "durationDays",
  review_every_days: "reviewEveryDays",
};

const Heading: React.FC<{ children: string }> = ({ children }) => (
  <Text variant="h3" weight="bold" style={{ marginTop: theme.spacing.md }}>
    {children}
  </Text>
);

const RemoveButton: React.FC<{ label: string; onPress: () => void; testID: string }> = ({ label, onPress, testID }) => (
  <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
    <Feather name="trash-2" size={18} color={theme.colors.secondary} />
  </Pressable>
);

const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: "Daily", days: DAILY },
  { label: "Weekdays", days: WEEKDAYS },
  { label: "Weekends", days: WEEKENDS },
];

/** The goal and task lists of the form: what the template copied, plus anything the nurse adds. */
const GoalsEditor: React.FC<{ draft: PlanDraft; set: (next: PlanDraft) => void; error?: string }> = ({ draft, set, error }) => {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [frequency, setFrequency] = useState<GoalFrequency>("daily");
  const [problem, setProblem] = useState<string | null>(null);

  const add = () => {
    const errors = validateGoal({ title, target });
    if (errors.title || errors.target) {
      setProblem(errors.title ?? errors.target ?? null);
      return;
    }
    setProblem(null);
    set({ ...draft, goals: [...draft.goals, { title: title.trim(), target: target.trim() || null, frequency }] });
    setTitle("");
    setTarget("");
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {draft.goals.length === 0 ? (
        <Text variant="small" color={theme.colors.textLight} testID="create-goals-empty">
          No goals yet. You can add them after the plan is created too.
        </Text>
      ) : null}
      {draft.goals.map((goal, i) => (
        <View key={`${goal.title}-${i}`} testID={`create-goal-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="body">{goal.title}</Text>
            <Text variant="caption" color={theme.colors.textLight}>
              {[goal.target, frequencyLabel(goal.frequency)].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <RemoveButton
            testID={`create-goal-remove-${i}`}
            label={`Remove goal ${goal.title}`}
            onPress={() => set({ ...draft, goals: draft.goals.filter((_, n) => n !== i) })}
          />
        </View>
      ))}
      <Card>
        <Input testID="create-goal-title" label="Goal" placeholder="For example: Keep fluids up" value={title} onChangeText={setTitle} />
        <Input testID="create-goal-target" label="Target (optional)" placeholder="For example: 1.5 L a day" value={target} onChangeText={setTarget} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {FREQUENCIES.map((f) => (
            <Chip key={f.value} testID={`create-goal-frequency-${f.value}`} label={f.label} selected={frequency === f.value} onPress={() => setFrequency(f.value)} />
          ))}
        </View>
        {problem ? <FieldHint text={problem} testID="create-goal-problem" /> : null}
        <Button testID="create-goal-add" title="Add goal" variant="outline" onPress={add} />
      </Card>
      {error ? <FieldHint text={error} /> : null}
    </View>
  );
};

/** "Activities": the daily tasks, one bordered row each (clock, slot and time, name, bin), and "+ Add More Activities". */
const TasksEditor: React.FC<{ draft: PlanDraft; set: (next: PlanDraft) => void; error?: string }> = ({ draft, set, error }) => {
  const [title, setTitle] = useState("");
  const [slot, setSlot] = useState<TimeSlot>("morning");
  const [days, setDays] = useState<number[]>(DAILY);
  const [problem, setProblem] = useState<string | null>(null);
  // With none yet the form is open; afterwards it opens from "Add More Activities".
  const [adding, setAdding] = useState(false);
  const formOpen = adding || draft.tasks.length === 0;

  const add = () => {
    const errors = validateGoal({ title, target: "" });
    if (errors.title) {
      setProblem(errors.title.replace("goal", "task"));
      return;
    }
    setProblem(null);
    const task: DraftTask = { title: title.trim(), time_slot: slot, time_of_day: null, days_of_week: days };
    set({ ...draft, tasks: [...draft.tasks, task] });
    setTitle("");
    setAdding(false);
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {draft.tasks.length === 0 ? (
        <Text variant="small" color={theme.colors.textLight} testID="create-tasks-empty">
          No daily tasks yet.
        </Text>
      ) : null}
      {draft.tasks.map((task, i) => (
        <View
          key={`${task.title}-${i}`}
          testID={`create-task-${i}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            borderRadius: theme.borderRadius.xl,
            backgroundColor: theme.colors.white,
          }}
        >
          <Feather name="clock" size={16} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" weight="medium" color={theme.colors.primary}>
              {`${slotLabel(task.time_slot)}${task.time_of_day ? ` ${task.time_of_day}` : ""} · ${daysLabel(task.days_of_week)}`}
            </Text>
            <Text variant="small" color={theme.colors.primary}>
              {task.title}
            </Text>
          </View>
          <RemoveButton
            testID={`create-task-remove-${i}`}
            label={`Remove task ${task.title}`}
            onPress={() => set({ ...draft, tasks: draft.tasks.filter((_, n) => n !== i) })}
          />
        </View>
      ))}
      {formOpen ? (
        <Card>
          <Input testID="create-task-title" label="Task" placeholder="For example: Assisted washing" value={title} onChangeText={setTitle} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {SLOTS.map((s) => (
              <Chip key={s.value} testID={`create-task-slot-${s.value}`} label={s.label} selected={slot === s.value} onPress={() => setSlot(s.value)} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {DAY_PRESETS.map((p) => (
              <Chip key={p.label} testID={`create-task-days-${p.label.toLowerCase()}`} label={p.label} selected={daysLabel(days) === p.label} onPress={() => setDays(p.days)} />
            ))}
          </View>
          {problem ? <FieldHint text={problem} testID="create-task-problem" /> : null}
          <Button testID="create-task-add" title="Add task" variant="outline" onPress={add} />
        </Card>
      ) : (
        <AddLink testID="create-task-more" label="Add More Activities" align="flex-end" onPress={() => setAdding(true)} />
      )}
      {error ? <FieldHint text={error} /> : null}
    </View>
  );
};

const CreateCarePlan: React.FC<Props> = ({ route }) => {
  const { bookingId, templateId, clientName } = route.params;
  const { navigation } = useNavigation();
  const template = usePlanTemplate(templateId);
  const create = useCreateCarePlan();

  const [draft, setDraft] = useState<PlanDraft>(emptyDraft);
  const [seeded, setSeeded] = useState(!templateId);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  // Copy the template into the form once, when it arrives; later edits are the nurse's.
  useEffect(() => {
    if (!seeded && template.data) {
      setDraft(templateToDraft(template.data));
      setSeeded(true);
    }
  }, [seeded, template.data]);

  const patch = (changes: Partial<PlanDraft>) => setDraft((d) => ({ ...d, ...changes }));

  const submit = () => {
    const found = validateDraft(draft);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    create.mutate(
      { bookingId, body: buildCreateBody(draft, templateId ?? null) },
      {
        onSuccess: (plan) => navigation.replace("CarePlanSuccess", { kind: "created", planId: plan.id }),
        onError: (error) => {
          const existing = existingPlanId(error);
          if (existing) {
            navigation.replace("CarePlanDetails", { planId: existing });
            return;
          }
          if (isNoAccess(error)) {
            setNoAccess(true);
            return;
          }
          const code = errorCode(error);
          if (code === "client_not_identified") setFormError(NOT_IDENTIFIED_HINT);
          else if (code === "not_a_nurse") setFormError(ONLY_NURSES_HINT);
          else {
            const field = validationField(error);
            const key = field ? SERVER_FIELD[field] : undefined;
            if (key) setErrors({ [key]: messageForError(error) });
            else setFormError(messageForError(error));
          }
        },
      },
    );
  };

  if (noAccess) {
    return <CarePlanNotice title={NOT_AVAILABLE_TITLE} message={NOT_AVAILABLE_HINT} actionLabel="Go back" onAction={() => navigation.goBack()} />;
  }
  if (templateId && template.isError && !template.data) {
    return (
      <PlanScreen title="Create New Care Plan">
        <ErrorState error={template.error} onRetry={() => void template.refetch()} />
      </PlanScreen>
    );
  }
  if (!seeded) {
    return (
      <PlanScreen title="Create New Care Plan">
        <LoadingState testID="create-loading" />
      </PlanScreen>
    );
  }

  return (
    <PlanScreen
      title="Create New Care Plan"
      subtitle="Create a health care plan for your patients"
      footer={<Button testID="create-submit" title="Create Care Plan" onPress={submit} loading={create.isPending} />}
    >
      <View style={{ gap: theme.spacing.sm }}>
        {clientName || template.data ? (
          <Text variant="small" weight="medium" color={theme.colors.primary} testID="create-for">
            {[clientName ? `For ${clientName}` : null, template.data ? `${template.data.name} template` : null].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        <Input
          testID="create-diagnosis"
          label="Medical Diagnosis *"
          placeholder="For example: Hypertension, early dementia"
          value={draft.diagnosis}
          onChangeText={(diagnosis) => patch({ diagnosis })}
          error={errors.diagnosis}
        />

        <View style={{ flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Select
              testID="create-risk"
              label="Risk Level *"
              placeholder="Select"
              options={RISKS.map((r) => ({ label: r.label, value: r.value }))}
              value={draft.risk ?? undefined}
              onValueChange={(value) => patch({ risk: value as PlanDraft["risk"] })}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateField
              testID="create-start"
              label="Start Date *"
              value={draft.startDate}
              onChange={(startDate) => patch({ startDate })}
              error={errors.startDate}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
        </View>
        {errors.risk ? <FieldHint text={errors.risk} testID="create-risk-error" /> : null}
        <Input
          testID="create-duration"
          label="Plan Duration (days)"
          placeholder="30"
          keyboardType="number-pad"
          value={draft.durationDays}
          onChangeText={(durationDays) => patch({ durationDays })}
          error={errors.durationDays}
        />
        <Input
          testID="create-review"
          label="Review Every (days, optional: clear to skip)"
          placeholder="No review"
          keyboardType="number-pad"
          value={draft.reviewEveryDays}
          onChangeText={(reviewEveryDays) => patch({ reviewEveryDays })}
          error={errors.reviewEveryDays}
        />

        <Heading>Goals</Heading>
        <GoalsEditor draft={draft} set={setDraft} error={errors.goals} />

        <Heading>Activities</Heading>
        <TasksEditor draft={draft} set={setDraft} error={errors.tasks} />

        <Input
          testID="create-allergies"
          label="Allergies (one per line, optional)"
          multiline
          inputStyle={{ minHeight: 72, textAlignVertical: "top" }}
          value={draft.allergies}
          onChangeText={(allergies) => patch({ allergies })}
          error={errors.allergies}
        />
        <Input
          testID="create-instructions"
          label="Any Special Instructions (one per line, optional)"
          multiline
          inputStyle={{ minHeight: 72, textAlignVertical: "top" }}
          value={draft.specialInstructions}
          onChangeText={(specialInstructions) => patch({ specialInstructions })}
          error={errors.specialInstructions}
        />

        {formError ? (
          <Text variant="small" color={theme.colors.errorText} testID="create-error">
            {formError}
          </Text>
        ) : null}
      </View>
    </PlanScreen>
  );
};

export default CreateCarePlan;
