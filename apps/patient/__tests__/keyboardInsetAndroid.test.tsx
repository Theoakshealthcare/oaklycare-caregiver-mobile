import { act, render, screen } from "@testing-library/react-native";
import React from "react";
import { Keyboard, Platform, Text, View } from "react-native";

import KeyboardInsetView from "../src/components/ui/keyboard-inset-view";

/** The chat composer sat under the Android keyboard: the view must end where the keyboard begins. */
describe("KeyboardInsetView (Android)", () => {
  const original = Platform.OS;
  const listeners: Record<string, (event: unknown) => void> = {};

  beforeEach(() => {
    Platform.OS = "android";
    jest.spyOn(Keyboard, "addListener").mockImplementation(((name: string, cb: (event: unknown) => void) => {
      listeners[name] = cb;
      return { remove: jest.fn() };
    }) as never);
    // The screen frame spans y=0..800 of the window.
    (View.prototype as unknown as { measureInWindow: unknown }).measureInWindow = (cb: (...n: number[]) => void) => cb(0, 0, 360, 800);
  });
  afterEach(() => {
    Platform.OS = original;
    jest.restoreAllMocks();
  });

  const bottomPadding = () => {
    const style = screen.getByTestId("keyboard-inset-frame").props.style as Record<string, unknown>[] | Record<string, unknown>;
    return Object.assign({}, ...(Array.isArray(style) ? style.flat() : [style])).paddingBottom as number;
  };

  it("pads the bottom by how far the keyboard covers it and clears it when the keyboard hides", async () => {
    await render(
      <KeyboardInsetView>
        <Text>composer</Text>
      </KeyboardInsetView>,
    );
    expect(bottomPadding()).toBe(0);
    await act(async () => listeners.keyboardDidShow?.({ endCoordinates: { screenY: 500, height: 300 } }));
    expect(bottomPadding()).toBe(300);
    await act(async () => listeners.keyboardDidHide?.({}));
    expect(bottomPadding()).toBe(0);
  });

  it("adds nothing when the window was already resized above the keyboard", async () => {
    await render(<KeyboardInsetView />);
    await act(async () => listeners.keyboardDidShow?.({ endCoordinates: { screenY: 800, height: 300 } }));
    expect(bottomPadding()).toBe(0);
  });
});
