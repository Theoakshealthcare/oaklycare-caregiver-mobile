import type React from "react";
import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { VitalRange } from "@/src/domain/vitals";

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
  /** Decides what the labels under the chart say (hours, weekdays or dates). */
  range?: VitalRange;
  height?: number;
  accessibilityLabel?: string;
}

/** How many labels sit under the chart (the design draws six, evenly spaced, with a faint line over each; a week gets one per day). */
const ticksFor = (range: VitalRange): number => (range === "week" ? 7 : 6);
const LINE = 2.5;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

/** Like `valueAt`, but eased (cosine) between two readings, so the line leaves and meets each reading smoothly, as drawn. */
export function smoothValueAt(points: ChartPoint[], t: number): number {
  if (points.length === 1 || t <= points[0].t) return points[0].v;
  const last = points[points.length - 1];
  if (t >= last.t) return last.v;
  const i = points.findIndex((p) => p.t >= t);
  const a = points[i - 1];
  const b = points[i];
  const k = (1 - Math.cos(Math.PI * ((t - a.t) / (b.t - a.t || 1)))) / 2;
  return a.v + (b.v - a.v) * k;
}

/** `hex` (#RRGGBB) mixed with white: `amount` of the colour. Opaque on purpose, so the overlapping columns of the area never darken. */
function onWhite(hex: string, amount: number): string {
  const channel = (i: number) => Math.round(255 - (255 - parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)) * amount);
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

/** "9am", "Mon" or "24 Nov": what a label under the chart says for the moment `t`. */
export function tickLabel(t: number, range: VitalRange): string {
  const d = new Date(t);
  if (range === "day") {
    const h = d.getHours();
    return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
  }
  if (range === "week") return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * The soft area chart of the monitoring page: the readings joined into a smooth line, the area under it tinted, a lighter band
 * round the latest reading, which is marked with a dot and its value, and six labels under it. Drawn with plain views (thin
 * columns for the area, short tilted bars for the line), so it needs no graphics library and no native build. `points` must be
 * sorted by time and fall inside `[from, to]`.
 */
const AreaChart: React.FC<AreaChartProps> = ({ points, from, to, color, range = "week", height = 180, accessibilityLabel }) => {
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
  const samples = width > 0 ? Math.min(90, Math.max(8, Math.floor(width / 4))) : 0;
  const step = samples > 1 ? width / (samples - 1) : 0;
  const heights = Array.from({ length: samples }, (_, i) => y(smoothValueAt(points, from + (i / (samples - 1)) * (to - from))));
  const last = points[points.length - 1];
  const lastX = ((last.t - from) / (to - from || 1)) * width;
  const band = width * 0.2;
  const bandLeft = Math.min(Math.max(lastX - band / 2, 0), Math.max(width - band, 0));
  const count = ticksFor(range);
  // A week gets one label per day, the last one for today; the others are spread from the start to the end of the window.
  const ticks = Array.from({ length: count }, (_, i) => (range === "week" ? (i + 1) / count : i / (count - 1)));
  const tint = onWhite(color, 0.16);

  return (
    <View onLayout={onLayout} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height }]}>
        {heights.map((h, i) => (
          <View key={`a${i}`} style={[styles.column, { left: i * step - step / 2, width: step + 2, height: Math.max(h, 1), backgroundColor: tint }]} />
        ))}
        <View style={[styles.band, { left: bandLeft, width: band }]} />
        {ticks.map((f) => (
          <View key={`g${f}`} style={[styles.grid, { left: Math.min(f * width, width - 1) }]} />
        ))}
        {heights.slice(1).map((h, i) => {
          const dx = step;
          const dy = h - heights[i];
          const length = Math.sqrt(dx * dx + dy * dy);
          const cx = i * step + step / 2;
          const cy = height - (h + heights[i]) / 2;
          return (
            <View
              key={`l${i}`}
              style={[
                styles.segment,
                { left: cx - length / 2 - 0.75, top: cy - LINE / 2, width: length + 1.5, backgroundColor: color, transform: [{ rotate: `${-Math.atan2(dy, dx)}rad` }] },
              ]}
            />
          );
        })}
        <View pointerEvents="none" style={[styles.markerWrap, { left: Math.min(Math.max(lastX, 0), width) - 14, bottom: y(valueAt(points, last.t)) - 5 }]}>
          <Text variant="small" weight="bold" color={color} style={styles.bubble}>
            {String(last.v)}
          </Text>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      </View>
      <View style={styles.labels}>
        {ticks.map((f) => (
          <Text key={f} variant="small" weight="medium">
            {tickLabel(from + f * (to - from), range)}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  plot: { marginTop: 28, overflow: "visible" },
  column: { position: "absolute", bottom: 0 },
  band: { position: "absolute", top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.45)" },
  grid: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(0,0,0,0.12)" },
  segment: { position: "absolute", height: LINE },
  markerWrap: { position: "absolute", width: 28, alignItems: "center" },
  bubble: { marginBottom: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.white },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing.sm },
});

export default AreaChart;
