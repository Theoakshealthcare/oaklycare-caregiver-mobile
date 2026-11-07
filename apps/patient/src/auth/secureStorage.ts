import * as SecureStore from "expo-secure-store";

import type { SessionTokens, TokenStorage } from "./session";

// Tokens live in the platform keychain / keystore. Nothing here is encrypted with an app-held key.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const ACCESS_KEY = "oakly.access_token";
const REFRESH_KEY = "oakly.refresh_token";
// The Expo push token this device registered; `clear()` wipes it on sign-out (after `authService.logout` has told the server).
const PUSH_TOKEN_KEY = "oakly.push_token";

export const secureTokenStorage: TokenStorage = {
  async load(): Promise<SessionTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY, OPTIONS),
      SecureStore.getItemAsync(REFRESH_KEY, OPTIONS),
    ]);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  },
  async save(tokens) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken, OPTIONS),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, OPTIONS),
    ]);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY, OPTIONS),
      SecureStore.deleteItemAsync(REFRESH_KEY, OPTIONS),
      SecureStore.deleteItemAsync(PUSH_TOKEN_KEY, OPTIONS),
    ]);
  },
};

/** The Expo push token this device registered with `POST /devices/push-token`; logout reads it to call DELETE. */
export const pushTokenStorage = {
  get: () => SecureStore.getItemAsync(PUSH_TOKEN_KEY, OPTIONS),
  set: (token: string) => SecureStore.setItemAsync(PUSH_TOKEN_KEY, token, OPTIONS),
};
