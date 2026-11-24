import { smoothValueAt, tickLabel, valueAt, type ChartPoint } from "@/src/components/vitals/AreaChart";
import { useScreenChrome } from "@/src/components/StatusBar/screenChrome";

const DAY = 24 * 3_600_000;
const points: ChartPoint[] = [
  { t: 0, v: 10 },
  { t: DAY, v: 30 },
];

describe("monitoring chart helpers", () => {
  it("reads the straight line between two readings, flat outside them", () => {
    expect(valueAt(points, DAY / 2)).toBe(20);
    expect(valueAt(points, -5)).toBe(10);
    expect(valueAt(points, 2 * DAY)).toBe(30);
  });

  it("eases between two readings: same ends and middle, gentler near the ends", () => {
    expect(smoothValueAt(points, 0)).toBe(10);
    expect(smoothValueAt(points, DAY)).toBe(30);
    expect(smoothValueAt(points, DAY / 2)).toBeCloseTo(20, 5);
    expect(smoothValueAt(points, DAY / 10)).toBeLessThan(valueAt(points, DAY / 10));
  });

  it("labels the axis with hours, weekdays or dates", () => {
    const t = new Date(2026, 10, 24, 15, 0, 0).getTime(); // Tuesday 24 Nov 2026, 3pm
    expect(tickLabel(t, "day")).toBe("3pm");
    expect(tickLabel(t, "week")).toBe("Tue");
    expect(tickLabel(t, "month")).toBe("24 Nov");
  });
});

describe("screen chrome dim", () => {
  it("is off until a modal route asks for it", () => {
    expect(useScreenChrome.getState().dim).toBeNull();
    useScreenChrome.getState().setDim("rgba(0,0,0,0.5)");
    expect(useScreenChrome.getState().dim).toBe("rgba(0,0,0,0.5)");
    useScreenChrome.getState().setDim(null);
    expect(useScreenChrome.getState().dim).toBeNull();
  });
});
