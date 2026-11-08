import { fireEvent, screen } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { useBookingDraft, EMPTY_DRAFT } from "../src/hooks/bookingDraft";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

/**
 * P1-04: on the simulator, fast injected typing showed text the app did not hold. The code was read for the usual causes
 * (a transformed value, a stale-closure setState, a debounced write) and none is there: every free-text field is a plain
 * controlled TextInput whose handler writes the new text with a functional update. These tests pin that: one change
 * event per keystroke ends with the field and the stored draft both holding the full text.
 */
describe("typing into the booking form keeps every keystroke", () => {
  // Same teardown as the other app-level suites: no query-cache gc timer left behind, so Jest exits.
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());
  beforeEach(() => useBookingDraft.setState({ draft: EMPTY_DRAFT }));

  const burst = async (label: string, text: string) => {
    const field = screen.getByLabelText(label);
    // One change event per keystroke. (The test renderer cannot overlap two events inside one render pass, so this proves the
    // handlers keep what they are given, not how the native side behaves under injected typing: that needs a phone.)
    for (let i = 0; i < text.length; i += 1) await fireEvent.changeText(field, text.slice(0, i + 1));
  };

  it("holds the text after one event per keystroke, and edits to different fields do not overwrite each other", async () => {
    const { view } = await renderSignedIn();
    await fireEvent.press(screen.getByRole("button", { name: "Start Booking" }));
    await burst("What help is needed?", "Wound dressing");
    await burst("Who are you booking for?", "My mother");
    await burst("Duration (hours)", "12");
    expect(useBookingDraft.getState().draft).toMatchObject({ assistance: "Wound dressing", forWhom: "My mother", durationHours: "12" });
    expect(screen.getByLabelText("What help is needed?").props.value).toBe("Wound dressing");
    expect(screen.getByLabelText("Who are you booking for?").props.value).toBe("My mother");

    await fireEvent.changeText(screen.getByLabelText("Who are you booking for?"), "Tunde");
    await fireEvent.changeText(screen.getByLabelText("What help is needed?"), "Walking");
    await fireEvent.changeText(screen.getByLabelText("Health condition (optional)"), "Hypertension");
    // Edits to different fields straight after one another: none overwrites another's text.
    expect(useBookingDraft.getState().draft).toMatchObject({ forWhom: "Tunde", assistance: "Walking", condition: "Hypertension" });
    view.unmount();
  });
});
