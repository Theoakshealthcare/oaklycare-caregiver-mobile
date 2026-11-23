import type React from "react";
import { StyleSheet, View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/** The red-dot sentences of "History & Insights" (Figma): one row per sentence the server's AI wrote. */
const InsightList: React.FC<{ lines: string[] }> = ({ lines }) => (
  <View style={styles.box}>
    {lines.map((line, i) => (
      <View key={`${i}-${line}`} style={styles.row}>
        <View style={styles.dot} />
        <Text variant="small" style={styles.text}>
          {line}
        </Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  box: { backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, gap: theme.spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm + 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: theme.colors.secondary },
  text: { flex: 1 },
});

export default InsightList;
