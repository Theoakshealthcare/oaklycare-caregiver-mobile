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

// Native modules the supply features touch. Tests that care override these with their own jest.mock.
jest.mock("expo-device", () => ({ isDevice: true }));

jest.mock("expo-task-manager", () => ({ defineTask: jest.fn(), isTaskDefined: jest.fn(() => true) }));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  startLocationUpdatesAsync: jest.fn(async () => undefined),
  stopLocationUpdatesAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: jest.fn(() => null),
}));
