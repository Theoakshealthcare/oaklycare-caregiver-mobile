import React from "react";
import { View } from "react-native";

import { Card } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  MEDICATION_EMPTY,
  MEDICATION_NOTICE,
  STOPPED_HEADING,
  medicationDatesLine,
  medicationDoseLine,
  medicationGroups,
  medicationScheduleLine,
  medicationStoppedLine,
} from "@/src/careplan/carePlanModel";
import type { CarePlan, CarePlanMedication } from "@/src/services/carePlans.service";

/** The "not clinical advice" notice. Always shown, to everyone who can see the section, even when the list is empty. */
export const MedicationNotice: React.FC = () => (
  <View
    testID="medication-notice"
    accessible
    accessibilityLabel={MEDICATION_NOTICE}
    style={{
      backgroundColor: theme.colors.secondaryLight,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
    }}
  >
    <Text variant="small" color={theme.colors.warningText}>
      {MEDICATION_NOTICE}
    </Text>
  </View>
);

const MedicationRow: React.FC<{ medication: CarePlanMedication }> = ({ medication: m }) => {
  const stopped = m.status !== "active";
  const lines = [medicationDoseLine(m), medicationScheduleLine(m), m.reason ? `For: ${m.reason}` : "", m.prescribed_by ? `Prescribed by ${m.prescribed_by}` : "", medicationDatesLine(m)].filter(Boolean);
  const muted = stopped ? theme.colors.textLight : undefined;
  return (
    <View testID={`medication-${m.id}`} style={{ gap: theme.spacing.xs }}>
      <Text variant="body" weight="bold" color={muted}>
        {m.name}
      </Text>
      {lines.map((line, i) => (
        <Text key={`${i}-${line}`} variant="small" color={theme.colors.textLight}>
          {line}
        </Text>
      ))}
      {m.note ? (
        <Text variant="small" color={muted}>
          {m.note}
        </Text>
      ) : null}
      {stopped ? (
        <Text variant="caption" weight="medium" color={theme.colors.textLight} testID={`medication-stopped-${m.id}`}>
          {medicationStoppedLine(m)}
        </Text>
      ) : null}
    </View>
  );
};

/**
 * "Medication schedules": a record of what the prescriber ordered (design decision D4). It is never collapsed, so the
 * notice is always on screen with it. Authors see Add (`can_edit_plan`, from the server); everyone with access reads the
 * list. There are no reminders, no "given" ticks and no "due" or "overdue" states: nothing here is computed from a time.
 */
const MedicationsSection: React.FC<{ plan: CarePlan; onAdd?: () => void }> = ({ plan, onAdd }) => {
  const { active, stopped } = medicationGroups(plan);
  return (
    <View
      testID="section-medications"
      style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.sm }}
    >
      <Text variant="body" weight="bold" accessibilityRole="header">
        Medication schedules
      </Text>
      <MedicationNotice />
      {plan.medications.length === 0 ? (
        <Text variant="small" color={theme.colors.textLight} testID="medications-empty">
          {MEDICATION_EMPTY}
        </Text>
      ) : null}
      {active.map((m) => (
        <Card key={m.id}>
          <MedicationRow medication={m} />
        </Card>
      ))}
      {stopped.length > 0 ? (
        <View testID="medications-stopped" style={{ gap: theme.spacing.sm }}>
          <Text variant="small" weight="bold" color={theme.colors.textLight} accessibilityRole="header">
            {STOPPED_HEADING}
          </Text>
          {stopped.map((m) => (
            <Card key={m.id}>
              <MedicationRow medication={m} />
            </Card>
          ))}
        </View>
      ) : null}
      {onAdd ? <Button testID="medication-add" title="Add Medication" variant="outline" onPress={onAdd} /> : null}
    </View>
  );
};

export default MedicationsSection;
