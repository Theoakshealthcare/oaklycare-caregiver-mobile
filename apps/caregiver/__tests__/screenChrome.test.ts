import { TEAL_CHROME, WHITE_CHROME, chromeStore } from "../src/components/StatusBar/screenChrome";
import { theme } from "../src/constants/theme";

describe("screen chrome (the safe-area bands)", () => {
  it("is teal with light status-bar icons until a screen asks otherwise", () => {
    expect(TEAL_CHROME).toEqual({ top: theme.colors.primary, bottom: theme.colors.primary, barStyle: "light-content" });
  });

  it("onboarding is edge-to-edge white with dark icons", () => {
    expect(WHITE_CHROME).toEqual({ top: "#FFFFFF", bottom: "#FFFFFF", barStyle: "dark-content" });
  });

  it("a bottom override wins over the bottom band and clears again", () => {
    chromeStore.setState({ ...WHITE_CHROME, bottomOverride: theme.colors.secondary });
    expect(chromeStore.getState().bottomOverride).toBe(theme.colors.secondary);
    chromeStore.setState({ bottomOverride: null });
    expect(chromeStore.getState().bottomOverride).toBeNull();
  });
});
