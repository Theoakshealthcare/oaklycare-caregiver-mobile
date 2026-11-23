import React, { useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { Chip, FieldHint, ModalFrame } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
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

const FREQUENCY_OPTIONS = [...PRESETS.map((p) => ({ label: p.label, value: p.key })), { label: "Choose days", value: "custom" }];

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
  // "Choose days" shows the seven day buttons; a preset hides them.
  const [custom, setCustom] = useState(false);
  const preset = PRESETS.find((p) => sameDays(draft.days, [...p.days]));
  const frequency = custom || !preset ? "custom" : preset.key;

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
    <ModalFrame testID="task-modal" title="Add New Daily Task" subtitle={`Create daily task for ${plan.client.full_name}`} onClose={onClose}>
      <Input
        testID="task-title"
        label="Task Name"
        placeholder="For example: Physiotherapy appointment"
        value={draft.title}
        onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
        error={errors.title}
      />
      <Select
        testID="task-slot"
        label="Task Routine"
        options={SLOTS.map((s) => ({ label: s.label, value: s.value }))}
        value={draft.slot}
        onValueChange={(value) => setDraft((d) => ({ ...d, slot: value as typeof d.slot }))}
        containerStyle={{ marginBottom: 0 }}
      />
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
      <Select
        testID="task-frequency"
        label="Task Frequency"
        options={FREQUENCY_OPTIONS}
        value={frequency}
        onValueChange={(value) => {
          const chosen = PRESETS.find((p) => p.key === value);
          setCustom(!chosen);
          if (chosen) setDraft((d) => ({ ...d, days: [...chosen.days] }));
        }}
        containerStyle={{ marginBottom: 0 }}
      />
      {frequency === "custom" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {WEEK_TABS.map((label, i) => (
            <Chip key={label} testID={`task-day-${i + 1}`} label={label} selected={draft.days.includes(i + 1)} onPress={() => toggleDay(i + 1)} />
          ))}
        </View>
      ) : null}
      {errors.days ? <FieldHint text={errors.days} testID="task-days-error" /> : null}
      {error ? <FieldHint text={error} testID="task-error" /> : null}
      <Button testID="task-save" title="Add New Daily Task" onPress={save} loading={add.isPending} />
    </ModalFrame>
  );
};

export default TaskModal;
