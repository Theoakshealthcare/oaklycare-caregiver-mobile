import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

interface UnitChecksProps {
  units: readonly string[];
  value: string;
  onChange: (unit: string) => void;
}

/** The unit boxes of the glucose and temperature sheets (Figma: "mg/dL", "mmol/L."): one ticked at a time. */
const UnitChecks: React.FC<UnitChecksProps> = ({ units, value, onChange }) => (
  <View style={styles.col}>
    {units.map((unit) => {
      const on = unit === value;
      return (
        <Pressable key={unit} accessibilityRole="checkbox" accessibilityLabel={unit} accessibilityState={{ checked: on }} onPress={() => onChange(unit)} style={styles.row}>
          <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="checkmark" size={14} color={theme.colors.white} /> : null}</View>
          <Text variant="small" weight="medium">
            {unit}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  col: { gap: theme.spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: theme.colors.primary },
});

export default UnitChecks;
