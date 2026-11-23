import type React from "react";
import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

export interface ChartPoint {
  /** Milliseconds since the epoch. */
  t: number;
  v: number;
}

interface AreaChartProps {
  points: ChartPoint[];
  /** The time window shown, `[from, to]` in milliseconds. */
  from: number;
  to: number;
  color: string;
  height?: number;
  accessibilityLabel?: string;
}

const COLUMN = 3;

/** The value of the line at time `t`: straight between two readings, flat before the first and after the last. */
export function valueAt(points: ChartPoint[], t: number): number {
  if (points.length === 1 || t <= points[0].t) return points[0].v;
  const last = points[points.length - 1];
  if (t >= last.t) return last.v;
  const i = points.findIndex((p) => p.t >= t);
  const a = points[i - 1];
  const b = points[i];
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t || 1);
}

/**
 * The soft area chart of the monitoring page: the readings joined into a line, the area under it tinted, and the latest reading
 * marked with a dot and its value. Drawn with plain views (a row of thin columns), so it needs no graphics library and no
 * native build. `points` must be sorted by time and fall inside `[from, to]`.
 */
const AreaChart: React.FC<AreaChartProps> = ({ points, from, to, color, height = 180, accessibilityLabel }) => {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const values = points.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // A little air under and over the line; a flat series sits mid-height.
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.25;
  const floor = lo - pad;
  const ceiling = hi + pad;
  const y = (v: number) => ((v - floor) / (ceiling - floor)) * height;
  const columns = width > 0 ? Math.floor(width / COLUMN) : 0;
  const last = points[points.length - 1];
  const lastX = ((last.t - from) / (to - from || 1)) * width;

  return (
    <View onLayout={onLayout} style={{ height: height + 28 }} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height }]}>
        {Array.from({ length: columns }, (_, i) => {
          const t = from + ((i + 0.5) / columns) * (to - from);
          const h = Math.max(2, y(valueAt(points, t)));
          return (
            <View key={i} style={[styles.column, { height: h, backgroundColor: `${color}26`, borderTopColor: color }]} />
          );
        })}
        <View pointerEvents="none" style={[styles.markerWrap, { left: Math.min(Math.max(lastX, 0), width) - 14, bottom: y(last.v) - 5 }]}>
          <Text variant="small" weight="bold" color={color} style={styles.bubble}>
            {String(last.v)}
          </Text>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "flex-end", overflow: "visible", marginTop: 28 },
  column: { width: COLUMN, borderTopWidth: 2 },
  markerWrap: { position: "absolute", width: 28, alignItems: "center" },
  bubble: { marginBottom: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.white },
});

export default AreaChart;
