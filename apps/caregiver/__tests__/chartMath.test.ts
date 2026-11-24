import { axisTicks, smoothLine } from "../src/vitals/chartMath";

describe("smoothLine", () => {
  it("passes through the first and last reading and every reading in between", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 5, y: 30 },
      { x: 10, y: 20 },
    ];
    const line = smoothLine(points, 11);
    expect(line).toHaveLength(11);
    expect(line[0]).toEqual({ x: 0, y: 10 });
    expect(line[5].y).toBeCloseTo(30);
    expect(line[10].y).toBeCloseTo(20);
  });

  it("never goes above the highest or below the lowest reading", () => {
    const points = [
      { x: 0, y: 5 },
      { x: 1, y: 50 },
      { x: 2, y: 6 },
      { x: 3, y: 60 },
    ];
    for (const p of smoothLine(points, 60)) {
      expect(p.y).toBeLessThanOrEqual(60 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(5 - 1e-9);
    }
  });

  it("is flat between equal readings", () => {
    const line = smoothLine(
      [
        { x: 0, y: 7 },
        { x: 4, y: 7 },
        { x: 8, y: 7 },
      ],
      9,
    );
    expect(line.every((p) => p.y === 7)).toBe(true);
  });

  it("handles no reading and one reading", () => {
    expect(smoothLine([], 10)).toEqual([]);
    expect(smoothLine([{ x: 3, y: 9 }], 10)).toEqual([{ x: 3, y: 9 }]);
  });
});

describe("axisTicks", () => {
  it("gives top, middle and bottom", () => {
    expect(axisTicks(36.2, 37.4)).toEqual([37.4, 36.8, 36.2]);
  });
});
