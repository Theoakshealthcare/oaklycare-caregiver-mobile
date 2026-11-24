import React, { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { axisTicks, smoothLine, type XY } from "@/src/vitals/chartMath";
import { formatClock, formatStamp } from "@/src/utils/dates";
import type { ChartPoint } from "@/src/vitals/vitalsModel";

const CHART_HEIGHT = 150;
const AXIS_WIDTH = 34;
/** Width the plot assumes until the screen reports its real one. */
const DEFAULT_WIDTH = 280;
const COLUMN_STEP = 3;
const MARKER = 6;
const LAST_MARKER = 14;
const LINE = 2;
/** Past this many readings the chart shows the most recent ones, so the curve stays readable. */
const MAX_POINTS = 60;

interface Props {
  points: ChartPoint[];
  /** The newest reading, written beside the highlighted point ("98.6"). */
  currentLabel?: string;
  testID?: string;
}

/** A line made of thin rotated views between two points (the app has no SVG library). */
const Segment: React.FC<{ from: XY; to: XY; color: string; thickness?: number }> = ({ from, to, color, thickness = LINE }) => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - thickness / 2,
        width: length + 0.5,
        height: thickness,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
};

/**
 * A smooth area line chart of the readings shown (oldest on the left), with the newest reading highlighted, three value
 * labels on the left and the first and last time below. Drawn with plain views: a curve that passes through each reading
 * (no overshoot), a pale fill under it, and a small dot on every real reading. There is no "normal" band because the app
 * does not judge readings. Blood pressure adds a lighter second line for the bottom number.
 */
const ReadingChart: React.FC<Props> = ({ points, currentLabel, testID = "vital-chart" }) => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const shown = useMemo(() => points.slice(-MAX_POINTS), [points]);
  const plotWidth = Math.max(width - AXIS_WIDTH, 40);
  const isPressure = shown.some((p) => p.low !== undefined);

  const geometry = useMemo(() => {
    if (shown.length === 0) return null;
    const values = shown.flatMap((p) => (p.low === undefined ? [p.value] : [p.value, p.low]));
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max === min) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.12;
    const lo = min - pad;
    const hi = max + pad;
    const t0 = shown[0].at;
    const t1 = shown[shown.length - 1].at;
    const xOf = (at: number) => (t1 === t0 ? plotWidth / 2 : ((at - t0) / (t1 - t0)) * (plotWidth - LAST_MARKER) + LAST_MARKER / 2);
    const yOf = (v: number) => CHART_HEIGHT - ((v - lo) / (hi - lo)) * CHART_HEIGHT;
    const curve = (pick: (p: ChartPoint) => number | undefined): XY[] => {
      const raw: XY[] = [];
      for (const p of shown) {
        const v = pick(p);
        if (v === undefined) continue;
        const x = xOf(p.at);
        if (raw.length > 0 && x <= raw[raw.length - 1].x) continue; // two readings at the same instant: keep the first
        raw.push({ x, y: yOf(v) });
      }
      return raw.length < 2 ? raw : smoothLine(raw, Math.max(2, Math.round((raw[raw.length - 1].x - raw[0].x) / COLUMN_STEP)));
    };
    return { top: curve((p) => p.value), low: isPressure ? curve((p) => p.low) : [], ticks: axisTicks(min, max), xOf, yOf };
  }, [shown, plotWidth, isPressure]);

  if (!geometry) {
    return (
      <View testID="chart-empty" style={{ height: CHART_HEIGHT, alignItems: "center", justifyContent: "center" }}>
        <Text variant="small" color={theme.colors.textLight}>
          No readings in this period
        </Text>
      </View>
    );
  }

  const last = shown[shown.length - 1];
  const first = shown[0];
  const lastX = geometry.xOf(last.at);
  const lastY = geometry.yOf(last.value);
  const sameDay = new Date(first.at).toDateString() === new Date(last.at).toDateString();
  const timeLabel = (at: number) => (sameDay ? formatClock(new Date(at)) : formatStamp(new Date(at)));

  return (
    <View style={{ gap: theme.spacing.xs }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: AXIS_WIDTH, height: CHART_HEIGHT, justifyContent: "space-between" }} testID="chart-axis">
          {geometry.ticks.map((tick, i) => (
            <Text key={i} variant="caption" color={theme.colors.textLight}>
              {String(tick)}
            </Text>
          ))}
        </View>
        <View
          testID={testID}
          accessibilityLabel={`Chart of ${shown.length} readings, latest ${last.label}`}
          style={{ width: plotWidth, height: CHART_HEIGHT, borderBottomWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}
        >
          {geometry.top.map((p, i) => (
            <View
              key={`area-${i}`}
              pointerEvents="none"
              style={{ position: "absolute", left: p.x - COLUMN_STEP / 2, bottom: 0, width: COLUMN_STEP + 0.5, height: CHART_HEIGHT - p.y, backgroundColor: theme.colors.primary, opacity: 0.12 }}
            />
          ))}
          {geometry.top.slice(1).map((p, i) => (
            <Segment key={`top-${i}`} from={geometry.top[i]} to={p} color={theme.colors.primary} />
          ))}
          {geometry.low.slice(1).map((p, i) => (
            <Segment key={`low-${i}`} from={geometry.low[i]} to={p} color={theme.colors.primary} thickness={1} />
          ))}
          {shown.map((p) =>
            p.id === last.id ? null : (
              <View
                key={p.id}
                testID="chart-point"
                accessibilityLabel={p.label}
                style={{
                  position: "absolute",
                  left: geometry.xOf(p.at) - MARKER / 2,
                  top: geometry.yOf(p.value) - MARKER / 2,
                  width: MARKER,
                  height: MARKER,
                  borderRadius: MARKER / 2,
                  backgroundColor: theme.colors.primary,
                }}
              />
            ),
          )}
          {currentLabel ? (
            <Text
              variant="caption"
              weight="bold"
              color={theme.colors.primary}
              testID="chart-last-label"
              style={{ position: "absolute", right: 0, top: Math.max(0, lastY - LAST_MARKER - 20) }}
            >
              {currentLabel}
            </Text>
          ) : null}
          <View
            testID="chart-last-point"
            accessibilityLabel={`Latest ${last.label}`}
            style={{
              position: "absolute",
              left: lastX - LAST_MARKER / 2,
              top: lastY - LAST_MARKER / 2,
              width: LAST_MARKER,
              height: LAST_MARKER,
              borderRadius: LAST_MARKER / 2,
              backgroundColor: theme.colors.primary,
              borderWidth: 3,
              borderColor: theme.colors.white,
            }}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: AXIS_WIDTH }} testID="chart-times">
        <Text variant="caption" color={theme.colors.textLight}>
          {first.id === last.id ? "" : timeLabel(first.at)}
        </Text>
        <Text variant="caption" color={theme.colors.textLight}>
          {timeLabel(last.at)}
        </Text>
      </View>
      {isPressure ? (
        <Text variant="caption" color={theme.colors.textLight} testID="chart-pressure-hint">
          The line follows the top number; the thin line is the bottom number.
        </Text>
      ) : null}
    </View>
  );
};

export default ReadingChart;
