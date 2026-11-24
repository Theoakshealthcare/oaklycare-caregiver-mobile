import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import BottomCta, { CTA_BOTTOM_GAP, ctaBottomPadding } from "../src/components/ui/bottom-cta";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

const paddingOf = (testID: string) => {
  const style = screen.getByTestId(testID).props.style as Record<string, unknown>[] | Record<string, unknown>;
  return Object.assign({}, ...(Array.isArray(style) ? style.flat() : [style])).paddingBottom as number;
};

describe("BottomCta: breathing room under a pinned button", () => {
  it("is 20 pt of gap, on top of the app root's own inset", () => {
    expect(CTA_BOTTOM_GAP).toBe(20);
    expect(ctaBottomPadding(34, false)).toBe(20);
  });

  it("adds the safe-area inset itself for content drawn outside the app root (a Modal)", () => {
    expect(ctaBottomPadding(34, true)).toBe(54);
    expect(ctaBottomPadding(0, true)).toBe(20);
  });

  it("applies that padding to the bar", async () => {
    await render(
      <>
        <BottomCta testID="in-root">
          <Text>Save</Text>
        </BottomCta>
        <BottomCta testID="in-modal" outsideAppRoot>
          <Text>Save</Text>
        </BottomCta>
      </>,
    );
    expect(paddingOf("in-root")).toBe(20);
    expect(paddingOf("in-modal")).toBe(54);
  });
});
