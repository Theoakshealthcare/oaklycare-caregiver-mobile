/**
 * Plain maths for the vital charts: a smooth line through a handful of readings, with no charting library.
 * Monotone cubic interpolation (Fritsch-Carlson): the curve passes through every reading and never overshoots between two,
 * so a smooth line cannot invent a spike or a dip the readings do not contain.
 */
export interface XY {
  x: number;
  y: number;
}

/** `points` sorted by x (ascending, distinct), sampled at `samples` evenly spaced x values from the first to the last. */
export function smoothLine(points: XY[], samples: number): XY[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1 || samples < 2) return [points[0]];

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push((points[i + 1].y - points[i].y) / dx[i]);
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangent[i] = (3 * a * slope[i]) / h;
      tangent[i + 1] = (3 * b * slope[i]) / h;
    }
  }

  const first = points[0].x;
  const span = points[n - 1].x - first;
  const out: XY[] = [];
  let segment = 0;
  for (let k = 0; k < samples; k += 1) {
    const x = first + (span * k) / (samples - 1);
    while (segment < n - 2 && x > points[segment + 1].x) segment += 1;
    const t = (x - points[segment].x) / dx[segment];
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      (2 * t3 - 3 * t2 + 1) * points[segment].y +
      (t3 - 2 * t2 + t) * dx[segment] * tangent[segment] +
      (-2 * t3 + 3 * t2) * points[segment + 1].y +
      (t3 - t2) * dx[segment] * tangent[segment + 1];
    out.push({ x, y });
  }
  return out;
}

/** Three evenly spaced axis labels (top, middle, bottom) for a value range, rounded to one decimal. */
export function axisTicks(min: number, max: number): number[] {
  const round = (n: number) => Math.round(n * 10) / 10;
  return [round(max), round((min + max) / 2), round(min)];
}
