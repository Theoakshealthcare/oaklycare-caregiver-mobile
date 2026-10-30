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
 * "normal" band because the app does not judge readings. A blood pressure bar floats: it runs from
 * the bottom number to the top number.
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
  const shown = bars.slice(-MAX_BARS);
  const isPressure = shown.some((bar) => bar.low !== undefined);
  const chart = (
    <View
      testID="vital-chart"
      style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 3, borderBottomWidth: 1, borderColor: theme.colors.border }}
    >
      {shown.map((bar) =>
        bar.low === undefined ? (
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
        ) : (
          <View key={bar.id} style={{ flex: 1, height: "100%" }}>
            <View
              testID="chart-bar"
              accessibilityLabel={bar.label}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: `${Math.round(bar.low * 100)}%`,
                height: `${Math.max(Math.round((bar.height - bar.low) * 100), 4)}%`,
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.sm,
              }}
            />
          </View>
        ),
      )}
    </View>
  );
  if (!isPressure) return chart;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {chart}
      <Text variant="caption" color={theme.colors.textLight} testID="chart-pressure-hint">
        Each bar runs from the bottom number to the top number.
      </Text>
    </View>
  );
};

export default ReadingChart;
