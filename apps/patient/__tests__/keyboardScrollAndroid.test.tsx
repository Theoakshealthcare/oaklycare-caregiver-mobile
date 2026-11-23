import { act, render, screen } from "@testing-library/react-native";
import React from "react";
import { Keyboard, Platform, Text, View } from "react-native";

import KeyboardScrollView, { keyboardOverlap } from "../src/components/ui/keyboard-scroll-view";

/** The sign-up form could not be scrolled above the Android keyboard: the scroll view must end where the keyboard begins. */
describe("keyboardOverlap", () => {
  it("is how far the keyboard covers the bottom of the frame, never negative", () => {
    expect(keyboardOverlap(800, 500)).toBe(300);
    expect(keyboardOverlap(800, 800)).toBe(0);
    expect(keyboardOverlap(500, 800)).toBe(0); // the system already resized the window above the keyboard
  });
});

describe("KeyboardScrollView (Android)", () => {
  const original = Platform.OS;
  const listeners: Record<string, (event: unknown) => void> = {};

  beforeEach(() => {
    Platform.OS = "android";
    jest.spyOn(Keyboard, "addListener").mockImplementation(((name: string, cb: (event: unknown) => void) => {
      listeners[name] = cb;
      return { remove: jest.fn() };
    }) as never);
    // The frame spans y=0..800 of the window.
    (View.prototype as unknown as { measureInWindow: unknown }).measureInWindow = (cb: (...n: number[]) => void) => cb(0, 0, 360, 800);
  });
  afterEach(() => {
    Platform.OS = original;
    jest.restoreAllMocks();
  });

  const frameBottomPadding = () => {
    const style = screen.getByTestId("keyboard-scroll-frame").props.style as Record<string, unknown>[] | Record<string, unknown>;
    return Object.assign({}, ...(Array.isArray(style) ? style : [style])).paddingBottom as number;
  };

  it("pads the bottom by how far the keyboard covers the scroll area, and clears it when the keyboard hides", async () => {
    await render(
      <KeyboardScrollView testID="scroll">
        <Text>field</Text>
      </KeyboardScrollView>,
    );
    expect(frameBottomPadding()).toBe(0);
    // Keyboard top edge at y=500 of an 800 high frame: the bottom 300 are covered.
    await act(async () => listeners.keyboardDidShow?.({ endCoordinates: { screenY: 500, height: 300 } }));
    expect(frameBottomPadding()).toBe(300);
    await act(async () => listeners.keyboardDidHide?.({}));
    expect(frameBottomPadding()).toBe(0);
  });

  it("adds nothing when the window was already resized above the keyboard", async () => {
    await render(<KeyboardScrollView testID="scroll" />);
    await act(async () => listeners.keyboardDidShow?.({ endCoordinates: { screenY: 800, height: 300 } }));
    expect(frameBottomPadding()).toBe(0);
  });

  it("keeps the scroll view's own props (taps work with the keyboard open, a drag dismisses it)", async () => {
    await render(<KeyboardScrollView testID="scroll" />);
    const props = screen.getByTestId("scroll").props as Record<string, unknown>;
    expect(props.keyboardShouldPersistTaps).toBe("handled");
    expect(props.keyboardDismissMode).toBe("on-drag");
  });
});
