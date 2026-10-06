import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"));
// The reanimated babel plugin injects getUseOfValueInStyleWarning for `.value` reads in JSX styles;
// the stock mock does not provide it.
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  getUseOfValueInStyleWarning: () => "",
}));
