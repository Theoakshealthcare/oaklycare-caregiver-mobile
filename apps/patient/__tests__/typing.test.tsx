import { fireEvent, screen } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { useBookingDraft, EMPTY_DRAFT } from "../src/hooks/bookingDraft";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { capture } from "../test-utils/captures";
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
    const { view } = await renderSignedIn({ "GET /api/v1/booking/services": () => ({ status: 200, body: capture("201-p-services-nurse-only").body }) });
    await fireEvent.press(screen.getByRole("button", { name: "Start Booking" }));
    // The free-text boxes of step 1 are the "Other" answers; the rest are dropdowns.
    await fireEvent.press(await screen.findByRole("button", { name: "What Assistance Do You Need?" }));
    await fireEvent.press(screen.getByRole("button", { name: "Other" }));
    await fireEvent.press(screen.getByRole("button", { name: "Do You Have Any Common Conditions?" }));
    await fireEvent.press(screen.getByRole("button", { name: "Other" }));
    await burst("Describe the help needed", "Wound dressing");
    await burst("Describe the condition", "Asthma");
    expect(useBookingDraft.getState().draft).toMatchObject({ assistanceOther: "Wound dressing", conditionOther: "Asthma" });
    expect(screen.getByLabelText("Describe the help needed").props.value).toBe("Wound dressing");
    expect(screen.getByLabelText("Describe the condition").props.value).toBe("Asthma");

    await fireEvent.changeText(screen.getByLabelText("Describe the condition"), "Hypertension");
    await fireEvent.changeText(screen.getByLabelText("Describe the help needed"), "Walking");
    // Edits to different fields straight after one another: none overwrites another's text.
    expect(useBookingDraft.getState().draft).toMatchObject({ assistanceOther: "Walking", conditionOther: "Hypertension" });
    view.unmount();
  });
});
