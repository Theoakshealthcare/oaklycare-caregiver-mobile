import React from "react";
import { View } from "react-native";

import { Accordion, AddLink } from "@/src/components/careplan/parts";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  MEDICATION_EMPTY,
  MEDICATION_NOTICE,
  STOPPED_HEADING,
  medicationDatesLine,
  clockLabel,
  medicationFrequencyLabel,
  medicationGroups,
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

/** "1 tablet · Oral": the dose and the route as the nurse wrote them (the strength is part of the name line). */
const doseAndRoute = (m: CarePlanMedication): string => [[m.dose_amount, m.dose_unit].filter(Boolean).join(" "), m.route].filter(Boolean).join(" · ");

const MedicationRow: React.FC<{ medication: CarePlanMedication }> = ({ medication: m }) => {
  const stopped = m.status !== "active";
  const times = m.times_of_day.map(clockLabel).join(", ");
  const extra = [m.reason ? `For: ${m.reason}` : "", m.prescribed_by ? `Prescribed by ${m.prescribed_by}` : "", medicationDatesLine(m)].filter(Boolean);
  const muted = stopped ? theme.colors.textLight : undefined;
  return (
    <View testID={`medication-${m.id}`} style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="small" weight="bold" color={muted}>
            {[m.name, m.strength].filter(Boolean).join(" ")}
          </Text>
          {doseAndRoute(m) ? (
            <Text variant="caption" color={theme.colors.textLight}>
              {doseAndRoute(m)}
            </Text>
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end", gap: 2 }}>
          <Text variant="small" weight="bold" color={stopped ? theme.colors.textLight : theme.colors.primary} testID={`medication-times-${m.id}`}>
            {times || medicationFrequencyLabel(m.frequency)}
          </Text>
          {m.note ? (
            <Text variant="caption" color={theme.colors.textLight} style={{ textAlign: "right" }}>
              {m.note}
            </Text>
          ) : null}
        </View>
      </View>
      {times ? (
        <Text variant="caption" color={theme.colors.textLight}>
          {medicationFrequencyLabel(m.frequency)}
        </Text>
      ) : null}
      {extra.map((line, i) => (
        <Text key={`${i}-${line}`} variant="caption" color={theme.colors.textLight}>
          {line}
        </Text>
      ))}
      {stopped ? (
        <Text variant="caption" weight="medium" color={theme.colors.textLight} testID={`medication-stopped-${m.id}`}>
          {medicationStoppedLine(m)}
        </Text>
      ) : null}
    </View>
  );
};

/**
 * "Medication Schedules": a record of what the prescriber ordered (design decision D4). It is a section like the others
 * (closed until opened, as Figma draws it), and the "not clinical advice" notice is the first thing inside it, so the
 * notice is always on screen whenever the list is. Authors see Add (`can_edit_plan`, from the server); everyone with access
 * reads the list. There are no reminders, no "given" ticks and no "due" or "overdue" states: nothing here is computed
 * from a time.
 */
const MedicationsSection: React.FC<{ plan: CarePlan; onAdd?: () => void }> = ({ plan, onAdd }) => {
  const { active, stopped } = medicationGroups(plan);
  return (
    <Accordion testID="section-medications" title="Medication Schedules">
      <MedicationNotice />
      {plan.medications.length === 0 ? (
        <Text variant="small" color={theme.colors.textLight} testID="medications-empty">
          {MEDICATION_EMPTY}
        </Text>
      ) : null}
      {active.map((m) => (
        <MedicationRow key={m.id} medication={m} />
      ))}
      {stopped.length > 0 ? (
        <View testID="medications-stopped" style={{ gap: theme.spacing.md }}>
          <Text variant="small" weight="bold" color={theme.colors.textLight} accessibilityRole="header">
            {STOPPED_HEADING}
          </Text>
          {stopped.map((m) => (
            <MedicationRow key={m.id} medication={m} />
          ))}
        </View>
      ) : null}
      {onAdd ? <AddLink testID="medication-add" label="Add New Medication" onPress={onAdd} /> : null}
    </Accordion>
  );
};

export default MedicationsSection;
