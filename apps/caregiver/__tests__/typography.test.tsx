import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { PixelRatio } from "react-native";

import Button from "../src/components/ui/button";
import Text from "../src/components/ui/text";
import { MAX_FONT_SCALE, scaleFactor, theme } from "../src/constants/theme";

// The app has no @types/node; describe just the bits this guard needs.
declare const __dirname: string;
const fs = jest.requireActual("fs") as {
  readdirSync(p: string): string[];
  statSync(p: string): { isDirectory(): boolean };
  readFileSync(p: string, enc: string): string;
};

describe("scaleFactor (damped, clamped width scale)", () => {
  it.each([
    [320, 1 + (320 / 390 - 1) * 0.5],
    [375, 1 + (375 / 390 - 1) * 0.5],
    [390, 1],
    [430, 1 + (430 / 390 - 1) * 0.5],
  ])("width %d is damped and unclamped", (width, expected) => {
    expect(scaleFactor(width)).toBeCloseTo(expected, 5);
    expect(scaleFactor(width)).toBeGreaterThanOrEqual(0.9);
    expect(scaleFactor(width)).toBeLessThanOrEqual(1.15);
  });

  it("is moderate: a 320 phone shrinks a little, a 430 phone grows a little", () => {
    expect(scaleFactor(320)).toBeLessThan(1);
    expect(scaleFactor(320)).toBeGreaterThan(0.9);
    expect(scaleFactor(430)).toBeGreaterThan(1);
    expect(scaleFactor(430)).toBeLessThan(1.15);
  });

  it("clamps at 1.15 for tablets and 0.9 for tiny screens", () => {
    expect(scaleFactor(768)).toBe(1.15);
    expect(scaleFactor(1200)).toBe(1.15);
    expect(scaleFactor(200)).toBe(0.9);
  });
});

describe("theme.sizes", () => {
  it("is a small fixed set of numbers", () => {
    expect(Object.keys(theme.sizes).sort()).toEqual(["body", "caption", "compact", "display", "fine", "heading", "label", "micro", "pageTitle", "subtitle", "title"]);
    const values = Object.values(theme.sizes);
    expect(values.every((v) => typeof v === "number")).toBe(true);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it("does not depend on the OS font scale (it is applied by React Native, capped by maxFontSizeMultiplier)", () => {
    const before = { ...theme.sizes };
    jest.isolateModules(() => {
      jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(2);
      const { theme: reloaded } = require("../src/constants/theme");
      expect(reloaded.sizes).toEqual(before);
    });
  });
});

describe("no raw fontSize numbers outside the theme", () => {
  const roots = [`${__dirname}/../src`, `${__dirname}/../App.tsx`, `${__dirname}/../MainApp.tsx`];
  const walk = (p: string): string[] =>
    fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((f: string) => walk(`${p}/${f}`)) : [p];

  it("every fontSize comes from theme.sizes", () => {
    const offenders = roots
      .flatMap(walk)
      .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.endsWith("constants/theme.ts"))
      .filter((f) => /fontSize:\s*\d/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("Text", () => {
  it("caps OS text scaling instead of disabling it", async () => {
    await render(<Text>Hello</Text>);
    const node = screen.getByText("Hello");
    expect(node.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    expect(node.props.allowFontScaling).not.toBe(false);
  });
});

describe("Button", () => {
  it("keeps the label on one line, shrinking before it breaks", async () => {
    const onPress = jest.fn();
    await render(<Button title="Decline" onPress={onPress} />);
    const label = screen.getByText("Decline");
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.minimumFontScale).toBe(0.85);
    expect(label.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    fireEvent.press(label);
    expect(onPress).toHaveBeenCalled();
  });
});
