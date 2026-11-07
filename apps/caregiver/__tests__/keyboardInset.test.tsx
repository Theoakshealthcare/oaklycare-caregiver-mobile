import { act, render, screen } from "@testing-library/react-native";
import React from "react";
import { Dimensions, Keyboard, Platform, Text } from "react-native";

import KeyboardInsetView from "../src/components/ui/keyboard-inset-view";
import KeyboardScrollView from "../src/components/ui/keyboard-scroll-view";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

/** DP1-03: the shared wrappers that keep focused fields, buttons and the chat composer above the keyboard. */
describe("KeyboardScrollView", () => {
  it("adjusts for the keyboard, keeps taps working and lets a drag dismiss it", async () => {
    await render(
      <KeyboardScrollView testID="scroll">
        <Text>field</Text>
      </KeyboardScrollView>,
    );
    const props = screen.getByTestId("scroll").props as Record<string, unknown>;
    expect(props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(props.keyboardShouldPersistTaps).toBe("handled");
    expect(props.keyboardDismissMode).toBe(Platform.OS === "ios" ? "interactive" : "on-drag");
  });

  it("lets a screen override the defaults", async () => {
    await render(<KeyboardScrollView testID="scroll" keyboardShouldPersistTaps="never" />);
    expect((screen.getByTestId("scroll").props as Record<string, unknown>).keyboardShouldPersistTaps).toBe("never");
  });
});

describe("KeyboardInsetView (iOS)", () => {
  const listeners: Record<string, (event: unknown) => void> = {};

  beforeEach(() => {
    Platform.OS = "ios";
    jest.spyOn(Dimensions, "get").mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    jest.spyOn(Keyboard, "addListener").mockImplementation(((name: string, cb: (event: unknown) => void) => {
      listeners[name] = cb;
      return { remove: jest.fn() };
    }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const bottomPadding = () => {
    const style = screen.getByTestId("inset").props.style as Record<string, unknown>[] | Record<string, unknown>;
    const flat = Object.assign({}, ...(Array.isArray(style) ? style : [style]));
    return flat.paddingBottom as number;
  };

  it("lifts the bottom edge by the keyboard height minus the home-indicator inset the app root already pads", async () => {
    await render(<KeyboardInsetView testID="inset" style={{ flex: 1 }} />);
    expect(bottomPadding()).toBe(0);
    // Keyboard top edge at y=544 of an 844pt window: 300pt up, 34 of which the root's safe area already covers.
    await act(async () => listeners.keyboardWillChangeFrame?.({ duration: 250, endCoordinates: { screenY: 544, height: 300 } }));
    expect(bottomPadding()).toBe(266);
  });

  it("drops back to 0 when the keyboard slides away, even though its reported height stays", async () => {
    await render(<KeyboardInsetView testID="inset" style={{ flex: 1 }} />);
    await act(async () => listeners.keyboardWillChangeFrame?.({ duration: 250, endCoordinates: { screenY: 544, height: 300 } }));
    await act(async () => listeners.keyboardWillChangeFrame?.({ duration: 250, endCoordinates: { screenY: 844, height: 300 } }));
    expect(bottomPadding()).toBe(0);
  });
});
