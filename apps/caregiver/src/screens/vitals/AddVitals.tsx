import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import ScreenShell from "@/src/components/account/ScreenShell";
import Text from "@/src/components/ui/text";
import VitalEntryModal from "@/src/components/vitals/VitalEntryModal";
import { theme } from "@/src/constants/theme";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { VITAL_KINDS, type VitalKind } from "@/src/vitals/vitalsModel";

type Props = StackScreenProps<ScreenParamLists, "AddVitals">;

/** "Add Manual Vital Readings": with patients on WhatsApp, readings the caregiver takes are the main source. */
const AddVitals: React.FC<Props> = ({ route }) => {
  const { patientId, patientName } = route.params;
  const [open, setOpen] = useState<VitalKind | null>(null);
  const [saved, setSaved] = useState<VitalKind[]>([]);

  return (
    <ScreenShell title="Add Manual Vital Readings" subtitle={patientName}>
      {VITAL_KINDS.map((info) => (
        <Pressable
          key={info.kind}
          testID={`entry-row-${info.kind}`}
          accessibilityRole="button"
          onPress={() => setOpen(info.kind)}
          style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.md }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
            <Feather name={info.icon} size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="bold">
              {info.label}
            </Text>
            <Text variant="small" color={saved.includes(info.kind) ? theme.colors.primary : theme.colors.textLight} testID={`entry-hint-${info.kind}`}>
              {saved.includes(info.kind) ? "Saved" : info.entryHint}
            </Text>
          </View>
          <Feather name="plus" size={20} color={theme.colors.primary} />
        </Pressable>
      ))}

      {open ? (
        <VitalEntryModal
          kind={open}
          patientId={patientId}
          onClose={() => setOpen(null)}
          onSaved={(kind) => {
            setSaved((prev) => (prev.includes(kind) ? prev : [...prev, kind]));
            setOpen(null);
          }}
        />
      ) : null}
    </ScreenShell>
  );
};

export default AddVitals;
