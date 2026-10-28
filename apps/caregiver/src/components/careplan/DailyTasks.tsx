import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { Chip, FieldHint } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  PAST_DAY_HINT,
  VISIT_ONLY_HINT,
  doneByText,
  isNoAccess,
  slotHeading,
  tickFailure,
  weekOf,
} from "@/src/careplan/carePlanModel";
import { useReloadAfterTick, useTaskDay, useTickTask } from "@/src/hooks/useCarePlanTasks";
import type { CarePlan, DayTask } from "@/src/services/carePlans.service";

const TickBox: React.FC<{ task: DayTask; enabled: boolean; pending: boolean; onPress: () => void }> = ({ task, enabled, pending, onPress }) => (
  <Pressable
    testID={`task-toggle-${task.id}`}
    accessibilityRole="checkbox"
    accessibilityLabel={task.title}
    accessibilityState={{ checked: task.done, disabled: !enabled || pending, busy: pending }}
    disabled={!enabled || pending}
    onPress={onPress}
    hitSlop={8}
    style={{
      width: 24,
      height: 24,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1.5,
      borderColor: task.done ? theme.colors.primary : theme.colors.border,
      backgroundColor: task.done ? theme.colors.primary : theme.colors.white,
      alignItems: "center",
      justifyContent: "center",
      opacity: enabled || task.done ? 1 : 0.5,
    }}
  >
    {pending ? (
      <ActivityIndicator size="small" color={theme.colors.primary} />
    ) : task.done ? (
      <Feather name="check" size={16} color={theme.colors.white} />
    ) : null}
  </Pressable>
);

/**
 * The Daily Care Task section: Monday-to-Sunday tabs around today, tasks by slot, and a tick box per task. Only
 * today can be ticked, and only during the caller's own visit; the server says so (`can_tick`) and a box changes
 * only after the server answers.
 */
const DailyTasks: React.FC<{ plan: CarePlan; onAddTask?: () => void; onNoAccess: () => void }> = ({ plan, onAddTask, onNoAccess }) => {
  // null = today (no `date` is sent, so the backend's Lagos date decides which day that is).
  const [selected, setSelected] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const today = useTaskDay(plan.id, null);
  const day = useTaskDay(plan.id, selected);
  const tick = useTickTask(plan.id);
  const reload = useReloadAfterTick(plan.id);

  const todayDate = today.data?.date ?? null;
  const week = todayDate ? weekOf(todayDate) : [];
  const shown = selected === null ? todayDate : selected;
  const error = day.error ?? today.error;
  const noAccess = !!error && isNoAccess(error);

  useEffect(() => {
    if (noAccess) onNoAccess();
  }, [noAccess, onNoAccess]);

  const choose = (date: string) => {
    setProblem(null);
    setSelected(date === todayDate ? null : date);
  };

  const apply = (task: DayTask, date: string, done: boolean) => {
    setProblem(null);
    tick.mutate(
      { taskId: task.id, date, done },
      {
        onError: (e) => {
          const failure = tickFailure(e, messageForError(e));
          if (failure.noAccess) return onNoAccess();
          setProblem(failure.message);
          reload(failure.reload);
        },
      },
    );
  };

  const toggle = (task: DayTask, date: string) => {
    if (!task.done) return apply(task, date, true);
    // Unticking is recorded in the plan's history, and may undo a colleague's tick (guide 16.19): always ask.
    Alert.alert("Untick this task?", "This is recorded in the plan's history and the care team can see it.", [
      { text: "Keep it ticked", style: "cancel" },
      { text: "Untick", style: "destructive", onPress: () => apply(task, date, false) },
    ]);
  };

  if (noAccess) return null;
  if (today.isError && !today.data) return <ErrorState error={today.error} onRetry={() => void today.refetch()} />;
  if (!today.data) return <LoadingState testID="tasks-loading" />;

  const data = day.data;
  const readOnly = !!data && !data.can_tick;
  const hint = !data
    ? null
    : !data.is_today
      ? PAST_DAY_HINT
      : !data.can_tick && plan.status === "active"
        ? VISIT_ONLY_HINT
        : null;

  return (
    <View testID="daily-tasks" style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
        {week.map((d) => (
          <Chip key={d.date} testID={`day-tab-${d.date}`} label={d.label} selected={d.date === shown} onPress={() => choose(d.date)} />
        ))}
      </View>
      {hint ? (
        <Text variant="caption" color={theme.colors.textLight} testID="tasks-hint">
          {hint}
        </Text>
      ) : null}

      {day.isError && !data ? (
        <ErrorState error={day.error} onRetry={() => void day.refetch()} />
      ) : !data ? (
        <LoadingState testID="tasks-day-loading" />
      ) : data.slots.length === 0 ? (
        <Text variant="small" color={theme.colors.textLight} testID="tasks-empty">
          No tasks on this day.
        </Text>
      ) : (
        data.slots.map((slot) => (
          <View key={slot.slot} testID={`slot-${slot.slot}`} style={{ gap: theme.spacing.xs }}>
            <Text variant="body" weight="bold">
              {slotHeading(slot.slot, slot.time_of_day)}
            </Text>
            {slot.tasks.map((task) => (
              <View
                key={task.id}
                testID={`task-${task.id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.sm,
                  padding: theme.spacing.sm,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.colors.soft,
                }}
              >
                <TickBox
                  task={task}
                  // One tick at a time: a second tap while one is open would lose the first one's refusal message.
                  enabled={!readOnly && !tick.isPending}
                  pending={tick.isPending && tick.variables?.taskId === task.id}
                  onPress={() => toggle(task, data.date)}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="small">{task.title}</Text>
                  {task.done ? (
                    <Text variant="caption" color={theme.colors.textLight} testID={`task-done-${task.id}`}>
                      {doneByText(task)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))
      )}

      {problem ? <FieldHint text={problem} testID="tasks-error" /> : null}
      {onAddTask ? <Button testID="task-add" title="Add New Task" variant="outline" onPress={onAddTask} /> : null}
    </View>
  );
};

export default DailyTasks;
