import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { APP_TEAL_TOP_CHROME, WHITE_CHROME, chromeForRoute } from "../src/components/StatusBar/screenChrome";
import Text from "../src/components/ui/text";
import { theme } from "../src/constants/theme";
import ConsentCard from "../src/screens/chat/voice/ConsentCard";
import { CONSENT_LINE, CONSENT_NOTE, CONSENT_TITLE } from "../src/voiceNotes/consentCopy";

/** Fixes found by the simulator pass of the signed-in caregiver app (ledgers/SIM-caregiver-visual.md). */

describe("Text forwards flex styles to its wrapper", () => {
  it("puts flex on the wrapper View so a long line wraps inside a row instead of running off the screen", async () => {
    const tree = (await render(
      <Text variant="small" style={{ flex: 1 }}>
        a very long line
      </Text>,
    )).toJSON() as { props: { style?: { flex?: number } } };
    expect(tree.props.style).toMatchObject({ flex: 1 });
  });

  it("leaves a plain Text wrapper without layout styles", async () => {
    const tree = (await render(<Text>plain</Text>)).toJSON() as { props: { style?: unknown } };
    expect(tree.props.style).toBeUndefined();
  });
});

describe("ConsentCard (AI Notetaker)", () => {
  it("keeps the counsel-reviewed words and testIDs", async () => {
    await render(<ConsentCard checked={false} onChange={() => undefined} />);
    expect(screen.getByText(CONSENT_TITLE)).toBeTruthy();
    expect(screen.getByTestId("consent-line")).toHaveTextContent(CONSENT_LINE);
    expect(screen.getByTestId("consent-note")).toHaveTextContent(CONSENT_NOTE);
  });

  it("is a checkbox row: tapping it asks to tick, and the state is announced", async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<ConsentCard checked={false} onChange={onChange} />);
    expect(screen.getByTestId("consent-checkbox").props.accessibilityState).toEqual({ checked: false });
    await fireEvent.press(screen.getByTestId("consent-checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
    await rerender(<ConsentCard checked onChange={onChange} />);
    expect(screen.getByTestId("consent-checkbox").props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(screen.getByTestId("consent-checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

describe("chromeForRoute (strips around the signed-in screens)", () => {
  it("is teal under the status bar only where Figma has a teal header, white under the home indicator", () => {
    for (const route of ["BottomNavigation", "CarePlans"]) {
      expect(chromeForRoute(route)).toEqual(APP_TEAL_TOP_CHROME);
    }
    expect(APP_TEAL_TOP_CHROME).toEqual({ top: theme.colors.primary, bottom: theme.colors.white, barStyle: "light-content" });
    // The chat's composer is pale teal, so the strip under it matches.
    expect(chromeForRoute("ChatScreen")).toMatchObject({ top: theme.colors.primary, bottom: theme.colors.primaryLight });
  });

  it("is white with dark icons on the plain pages and off-white on the care plan pages", () => {
    for (const route of ["Profile", "Wallet", "Notifications", "BookingDetails", "AINoteTaker", "ClientProfile"]) {
      expect(chromeForRoute(route)).toEqual(WHITE_CHROME);
    }
    expect(chromeForRoute("CarePlanDetails")).toEqual({
      top: theme.colors.careBackground,
      bottom: theme.colors.careBackground,
      barStyle: "dark-content",
    });
  });
});
