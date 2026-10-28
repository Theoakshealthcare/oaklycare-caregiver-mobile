import React, { useState } from "react";
import { Alert, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { Chip, FieldHint, ModalFrame } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  CONFLICT_HINT,
  ONLY_NURSES_HINT,
  RISKS,
  conflictPlan,
  errorCode,
  isNoAccess,
  validateHeader,
  type DraftErrors,
  type RiskLevel,
} from "@/src/careplan/carePlanModel";
import { usePatchCarePlan } from "@/src/hooks/useCarePlans";
import type { CarePlan, CarePlanPatchBody } from "@/src/services/carePlans.service";

type Closing = "completed" | "archived";

/** The pencil on the plan header: diagnosis, risk, dates, and the one-way "Mark completed" / "Archive". */
const EditPlanSheet: React.FC<{ plan: CarePlan; onClose: () => void; onNoAccess: () => void }> = ({ plan, onClose, onNoAccess }) => {
  const patch = usePatchCarePlan(plan.id);
  // What the nurse saw when the sheet opened. After a version conflict `plan` becomes the newer one, but
  // the diff stays against this, so a field the nurse did not touch is never sent (and never reverts
  // another author's change); only `expected_version` follows the live plan.
  const [base] = useState(plan);
  const [diagnosis, setDiagnosis] = useState(base.diagnosis);
  const [risk, setRisk] = useState<RiskLevel>(base.risk_level);
  const [startDate, setStartDate] = useState(base.start_date);
  const [durationDays, setDurationDays] = useState(String(base.duration_days));
  const [reviewEveryDays, setReviewEveryDays] = useState(base.review_every_days ? String(base.review_every_days) : "");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [error, setError] = useState<string | null>(null);

  const send = (body: Omit<CarePlanPatchBody, "expected_version">) => {
    setError(null);
    patch.mutate(
      { expected_version: plan.version, ...body },
      {
        onSuccess: onClose,
        onError: (e) => {
          if (isNoAccess(e)) return onNoAccess();
          const code = errorCode(e);
          if (conflictPlan(e)) setError(CONFLICT_HINT);
          else if (code === "not_a_nurse") setError(ONLY_NURSES_HINT);
          else setError(messageForError(e));
        },
      },
    );
  };

  const save = () => {
    const found = validateHeader({ diagnosis, startDate, durationDays, reviewEveryDays });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // Only what changed is sent, so a stale edit of one field cannot undo another author's other field.
    const changes: Omit<CarePlanPatchBody, "expected_version"> = {};
    if (diagnosis.trim() !== base.diagnosis) changes.diagnosis = diagnosis.trim();
    if (risk !== base.risk_level) changes.risk_level = risk;
    if (startDate.trim() && startDate.trim() !== base.start_date) changes.start_date = startDate.trim();
    if (durationDays.trim() && Number(durationDays) !== base.duration_days) changes.duration_days = Number(durationDays);
    const review = reviewEveryDays.trim() ? Number(reviewEveryDays) : null;
    if (review !== (base.review_every_days ?? null)) changes.review_every_days = review;
    if (Object.keys(changes).length === 0) return onClose();
    send(changes);
  };

  const close = (status: Closing) =>
    Alert.alert(
      status === "completed" ? "Mark this plan completed?" : "Archive this plan?",
      "The plan becomes read-only and the client can have a new active plan. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: status === "completed" ? "Mark completed" : "Archive", style: "destructive", onPress: () => send({ status }) },
      ],
    );

  return (
    <ModalFrame testID="edit-plan" title="Edit care plan" onClose={onClose}>
      <Input testID="edit-diagnosis" label="Medical diagnosis" value={diagnosis} onChangeText={setDiagnosis} error={errors.diagnosis} />
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="small">Risk level</Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          {RISKS.map((r) => (
            <Chip key={r.value} testID={`edit-risk-${r.value}`} label={r.label} selected={risk === r.value} onPress={() => setRisk(r.value)} />
          ))}
        </View>
      </View>
      <Input testID="edit-start" label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} autoCapitalize="none" error={errors.startDate} />
      <Input testID="edit-duration" label="Plan duration (days)" keyboardType="number-pad" value={durationDays} onChangeText={setDurationDays} error={errors.durationDays} />
      <Input
        testID="edit-review"
        label="Review every (days, optional)"
        keyboardType="number-pad"
        value={reviewEveryDays}
        onChangeText={setReviewEveryDays}
        error={errors.reviewEveryDays}
      />
      {error ? <FieldHint text={error} testID="edit-error" /> : null}
      <Button testID="edit-save" title="Save changes" onPress={save} loading={patch.isPending} />
      <Button testID="edit-complete" title="Mark plan completed" variant="outline" onPress={() => close("completed")} disabled={patch.isPending} />
      <Button testID="edit-archive" title="Archive plan" variant="outline" onPress={() => close("archived")} disabled={patch.isPending} />
    </ModalFrame>
  );
};

export default EditPlanSheet;
