import { BACKGROUND_RATIONALE, FOREGROUND_RATIONALE, LOCATION_SHARING_SENTENCE } from "../src/supply/permissions";

describe("location permission copy (DP1-13)", () => {
  it("both permission sheets carry the one shared sentence and never contradict it", () => {
    expect(FOREGROUND_RATIONALE.message).toContain(LOCATION_SHARING_SENTENCE);
    expect(BACKGROUND_RATIONALE.message).toContain(LOCATION_SHARING_SENTENCE);
    // The three old, contradicting phrasings are gone.
    for (const text of [FOREGROUND_RATIONALE.message, BACKGROUND_RATIONALE.message]) {
      expect(text).not.toMatch(/only shared while the app is open/i);
      expect(text).not.toMatch(/even when the app is closed/i);
    }
  });

  it("states when location is shared: available with the app open, and on a visit until it is completed", () => {
    expect(LOCATION_SHARING_SENTENCE).toMatch(/available and the app is open/);
    expect(LOCATION_SHARING_SENTENCE).toMatch(/On my way/);
    expect(LOCATION_SHARING_SENTENCE).toMatch(/until you complete a visit/);
  });
});
