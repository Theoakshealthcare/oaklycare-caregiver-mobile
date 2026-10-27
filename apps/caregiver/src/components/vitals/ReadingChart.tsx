import React from "react";
import { View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { ChartBar } from "@/src/vitals/vitalsModel";

const CHART_HEIGHT = 140;
/** Past this many readings the chart shows the most recent ones, so bars stay readable. */
const MAX_BARS = 40;

/**
 * A plain bar chart (one bar per reading, oldest on the left), drawn with Views so it needs no
 * charting library. Bars are scaled between the lowest and highest reading shown; there is no
 * "normal" band because the app does not judge readings.
 */
const ReadingChart: React.FC<{ bars: ChartBar[] }> = ({ bars }) => {
  if (bars.length === 0) {
    return (
      <View testID="chart-empty" style={{ height: CHART_HEIGHT, alignItems: "center", justifyContent: "center" }}>
        <Text variant="small" color={theme.colors.textLight}>
          No readings in this period
        </Text>
      </View>
    );
  }
  return (
    <View
      testID="vital-chart"
      style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 3, borderBottomWidth: 1, borderColor: theme.colors.border }}
    >
      {bars.slice(-MAX_BARS).map((bar) => (
        <View
          key={bar.id}
          testID="chart-bar"
          accessibilityLabel={bar.label}
          style={{
            flex: 1,
            height: `${Math.round(bar.height * 100)}%`,
            backgroundColor: theme.colors.primary,
            borderTopLeftRadius: theme.borderRadius.sm,
            borderTopRightRadius: theme.borderRadius.sm,
          }}
        />
      ))}
    </View>
  );
};

export default ReadingChart;
