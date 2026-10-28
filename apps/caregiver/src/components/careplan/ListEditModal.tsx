import React, { useState } from "react";

import { messageForError } from "@/src/api/errors";
import { FieldHint, ModalFrame } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import {
  CONFLICT_HINT,
  ONLY_NURSES_HINT,
  conflictPlan,
  errorCode,
  isNoAccess,
  joinLines,
  splitLines,
  validateLines,
} from "@/src/careplan/carePlanModel";
import { usePatchCarePlan } from "@/src/hooks/useCarePlans";
import type { CarePlan } from "@/src/services/carePlans.service";

export type ListField = "allergies" | "special_instructions";

const COPY: Record<ListField, { title: string; label: string }> = {
  allergies: { title: "Edit allergies", label: "Allergies, one per line" },
  special_instructions: { title: "Edit special instructions", label: "Special instructions, one per line" },
};

/** Allergies and special instructions are lists of lines; clearing the box clears the list. */
const ListEditModal: React.FC<{ plan: CarePlan; field: ListField; onClose: () => void; onNoAccess: () => void }> = ({
  plan,
  field,
  onClose,
  onNoAccess,
}) => {
  const patch = usePatchCarePlan(plan.id);
  const [text, setText] = useState(joinLines(plan[field]));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const problem = validateLines(text);
    if (problem) return setError(problem);
    setError(null);
    const lines = splitLines(text);
    patch.mutate(
      { expected_version: plan.version, [field]: lines.length > 0 ? lines : null },
      {
        onSuccess: onClose,
        onError: (e) => {
          if (isNoAccess(e)) return onNoAccess();
          if (conflictPlan(e)) setError(CONFLICT_HINT);
          else if (errorCode(e) === "not_a_nurse") setError(ONLY_NURSES_HINT);
          else setError(messageForError(e));
        },
      },
    );
  };

  return (
    <ModalFrame testID="list-edit" title={COPY[field].title} onClose={onClose}>
      <Input
        testID="list-edit-text"
        label={COPY[field].label}
        multiline
        inputStyle={{ minHeight: 120, textAlignVertical: "top" }}
        value={text}
        onChangeText={setText}
      />
      {error ? <FieldHint text={error} testID="list-edit-error" /> : null}
      <Button testID="list-edit-save" title="Save" onPress={save} loading={patch.isPending} />
    </ModalFrame>
  );
};

export default ListEditModal;
