import React, { useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { Chip, FieldHint, ModalFrame } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  DAILY,
  ONLY_NURSES_HINT,
  SLOTS,
  WEEKDAYS,
  WEEKENDS,
  WEEK_TABS,
  buildTaskBody,
  emptyTaskDraft,
  errorCode,
  isNoAccess,
  validateTask,
  validationField,
} from "@/src/careplan/carePlanModel";
import { useAddTask } from "@/src/hooks/useCarePlanTasks";
import type { CarePlan } from "@/src/services/carePlans.service";

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

const PRESETS = [
  { key: "daily", label: "Daily", days: DAILY },
  { key: "weekdays", label: "Weekdays", days: WEEKDAYS },
  { key: "weekends", label: "Weekends", days: WEEKENDS },
] as const;

/**
 * "Add New Daily Task" (nurses): name, routine (the slot), an optional time and the days. A task is scheduled from
 * the day it is added, and adding never overwrites anything, so no version is sent.
 */
const TaskModal: React.FC<{
  plan: CarePlan;
  onClose: () => void;
  onSaved: () => void;
  onNoAccess: () => void;
}> = ({ plan, onClose, onSaved, onNoAccess }) => {
  const add = useAddTask(plan.id);
  const [draft, setDraft] = useState(emptyTaskDraft);
  const [errors, setErrors] = useState<{ title?: string; time?: string; days?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) =>
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] }));

  const fail = (e: unknown) => {
    if (isNoAccess(e)) return onNoAccess();
    const code = errorCode(e);
    if (code === "not_a_nurse") return setError(ONLY_NURSES_HINT);
    const field = validationField(e);
    if (field === "title") return setErrors({ title: messageForError(e) });
    if (field === "time_of_day") return setErrors({ time: messageForError(e) });
    setError(messageForError(e));
  };

  const save = () => {
    const found = validateTask(draft);
    setErrors(found);
    setError(null);
    if (found.title || found.time || found.days) return;
    add.mutate(buildTaskBody(draft), { onSuccess: onSaved, onError: fail });
  };

  return (
    <ModalFrame testID="task-modal" title="Add New Daily Task" onClose={onClose}>
      <Text variant="small" color={theme.colors.textLight}>{`Create a daily task for ${plan.client.full_name}`}</Text>
      <Input
        testID="task-title"
        label="Task name"
        placeholder="For example: Physiotherapy appointment"
        value={draft.title}
        onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
        error={errors.title}
      />
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="small">Task routine</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {SLOTS.map((s) => (
            <Chip key={s.value} testID={`task-slot-${s.value}`} label={s.label} selected={draft.slot === s.value} onPress={() => setDraft((d) => ({ ...d, slot: s.value }))} />
          ))}
        </View>
      </View>
      <Input
        testID="task-time"
        label="Time (optional, 24-hour HH:MM)"
        placeholder="08:00"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        value={draft.time}
        onChangeText={(time) => setDraft((d) => ({ ...d, time }))}
        error={errors.time}
      />
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="small">Task frequency</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {PRESETS.map((p) => (
            <Chip key={p.key} testID={`task-days-${p.key}`} label={p.label} selected={sameDays(draft.days, [...p.days])} onPress={() => setDraft((d) => ({ ...d, days: [...p.days] }))} />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {WEEK_TABS.map((label, i) => (
            <Chip key={label} testID={`task-day-${i + 1}`} label={label} selected={draft.days.includes(i + 1)} onPress={() => toggleDay(i + 1)} />
          ))}
        </View>
        {errors.days ? <FieldHint text={errors.days} testID="task-days-error" /> : null}
      </View>
      {error ? <FieldHint text={error} testID="task-error" /> : null}
      <Button testID="task-save" title="Add New Daily Task" onPress={save} loading={add.isPending} />
    </ModalFrame>
  );
};

export default TaskModal;
