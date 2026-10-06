import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"));
// The reanimated babel plugin injects getUseOfValueInStyleWarning for `.value` reads in JSX styles;
// the stock mock does not provide it.
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  getUseOfValueInStyleWarning: () => "",
}));

// expo-secure-store has no JS fallback under jest: an in-memory keychain.
jest.mock("expo-secure-store", () => {
  const items = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      items.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      items.delete(key);
    },
  };
});

// The expo-audio native module is not available under jest.
jest.mock("expo-audio", () => ({
  useAudioRecorder: () => ({ prepareToRecordAsync: async () => {}, record: () => {}, stop: async () => {}, uri: null }),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
  setAudioModeAsync: async () => {},
}));
