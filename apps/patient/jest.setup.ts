import "react-native-gesture-handler/jestSetup";

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
    // Test-only: lets a test look at what is still in the keychain after a logout.
    __keys: () => [...items.keys()],
  };
});

// SafeAreaProvider only renders children after a native layout pass; use the library's jest mock (zero insets).
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// The api client captures `fetch` when it is created (at import), so install one late-bound mock here, before any
// app module loads. Tests route it with `routeFetch` (test-utils/fakeApi.ts); an unrouted call fails loudly.
globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
  throw new TypeError(`unmocked fetch: ${typeof input === "string" ? input : (input as Request).url}`);
}) as unknown as typeof fetch;
