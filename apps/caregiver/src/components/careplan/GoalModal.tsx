import React, { useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { Chip, FieldHint, ModalFrame } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  CONFLICT_HINT,
  FREQUENCIES,
  ONLY_NURSES_HINT,
  conflictPlan,
  errorCode,
  isNoAccess,
  validateGoal,
} from "@/src/careplan/carePlanModel";
import { useAddGoal, useEditGoal } from "@/src/hooks/useCarePlans";
import type { CarePlan, CarePlanGoal, GoalFrequency } from "@/src/services/carePlans.service";

/**
 * Add a goal, or edit one (title, target, frequency). On a stale version the server's current plan
 * replaces the cache and the typed text stays, so the nurse can save again.
 */
const GoalModal: React.FC<{
  plan: CarePlan;
  goal?: CarePlanGoal;
  onClose: () => void;
  onSaved: (kind: "added" | "edited") => void;
  onNoAccess: () => void;
}> = ({ plan, goal, onClose, onSaved, onNoAccess }) => {
  // The goal as the nurse opened it: an edit sends only what they changed, even after a conflict reload.
  const [base] = useState(goal);
  const add = useAddGoal(plan.id);
  const edit = useEditGoal(plan.id);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [target, setTarget] = useState(goal?.target ?? "");
  const [frequency, setFrequency] = useState<GoalFrequency>(goal?.frequency ?? "daily");
  const [errors, setErrors] = useState<{ title?: string; target?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => {
    if (isNoAccess(e)) return onNoAccess();
    const code = errorCode(e);
    if (conflictPlan(e)) setError(CONFLICT_HINT);
    else if (code === "not_a_nurse") setError(ONLY_NURSES_HINT);
    else setError(messageForError(e));
  };

  const save = () => {
    const found = validateGoal({ title, target });
    setErrors(found);
    setError(null);
    if (found.title || found.target) return;
    const next = { title: title.trim(), target: target.trim() || null, frequency };
    if (goal && base) {
      const changes: Partial<typeof next> = {};
      if (next.title !== base.title) changes.title = next.title;
      if (next.target !== (base.target ?? null)) changes.target = next.target;
      if (next.frequency !== base.frequency) changes.frequency = next.frequency;
      if (Object.keys(changes).length === 0) return onClose();
      edit.mutate({ goalId: goal.id, expectedVersion: plan.version, changes }, { onSuccess: () => onSaved("edited"), onError: fail });
    } else {
      add.mutate(next, { onSuccess: () => onSaved("added"), onError: fail });
    }
  };

  return (
    <ModalFrame testID="goal-modal" title={goal ? "Edit care goal" : "Add care goal"} onClose={onClose}>
      <Input testID="goal-title" label="Goal" placeholder="For example: Safe mobility and transfers" value={title} onChangeText={setTitle} error={errors.title} />
      <Input testID="goal-target" label="Target or measure (optional)" placeholder="For example: 1.5 L fluids a day" value={target} onChangeText={setTarget} error={errors.target} />
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="small">How often</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {FREQUENCIES.map((f) => (
            <Chip key={f.value} testID={`goal-frequency-${f.value}`} label={f.label} selected={frequency === f.value} onPress={() => setFrequency(f.value)} />
          ))}
        </View>
      </View>
      {error ? <FieldHint text={error} testID="goal-error" /> : null}
      <Button testID="goal-save" title={goal ? "Save goal" : "Add goal"} onPress={save} loading={add.isPending || edit.isPending} />
    </ModalFrame>
  );
};

export default GoalModal;
