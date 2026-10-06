import * as Notifications from "expo-notifications";

import { session } from "../src/auth";
import { easProjectId, nativePushDeps } from "../src/push/native";
import { registerForPush } from "../src/push/registration";
import { authService } from "../src/services/auth.service";

jest.mock("../src/api/client", () => {
  const { createOaklyClient } = jest.requireActual("@oakly/api-client");
  return {
    api: createOaklyClient({
      baseUrl: "http://test.local",
      getAccessToken: () => "access",
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    }),
  };
});

let mockExtra: unknown;
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));

describe("easProjectId", () => {
  it("reads Constants.expoConfig.extra.eas.projectId", () => {
    mockExtra = { eas: { projectId: "11111111-1111-4111-8111-111111111111" } };
    expect(easProjectId()).toBe("11111111-1111-4111-8111-111111111111");
  });

  it.each([undefined, {}, { eas: {} }, { eas: { projectId: "" } }, { eas: { projectId: 5 } }, { eas: null }])(
    "is undefined when extra is %p (no EAS project yet)",
    (extra) => {
      mockExtra = extra;
      expect(easProjectId()).toBeUndefined();
    },
  );
});

describe("native push wiring", () => {
  afterEach(() => jest.restoreAllMocks());

  it("without an EAS project nothing is requested from Expo or the backend", async () => {
    mockExtra = undefined;
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    const result = await registerForPush({ ...nativePushDeps(), log: () => undefined });
    expect(result).toEqual({ status: "skipped", reason: "no_project_id" });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("registers with the projectId, stores the token where logout reads it, and logout forgets it", async () => {
    mockExtra = { eas: { projectId: "11111111-1111-4111-8111-111111111111" } };
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true, canAskAgain: true });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
      data: "ExponentPushToken[placeholder-live]",
    });
    const requests: Array<{ method: string; url: string; body: unknown }> = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      const text = await request.text();
      requests.push({ method: request.method, url: request.url, body: text ? JSON.parse(text) : null });
      return request.method === "DELETE"
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ token: "ExponentPushToken[placeholder-live]", platform: "ios" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
    });

    await session.signIn({ accessToken: "access", refreshToken: "refresh" });
    const result = await registerForPush({ ...nativePushDeps(), log: () => undefined });

    expect(result).toMatchObject({ status: "registered", token: "ExponentPushToken[placeholder-live]" });
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "11111111-1111-4111-8111-111111111111" });
    expect(requests[0]).toMatchObject({
      method: "POST",
      body: { token: "ExponentPushToken[placeholder-live]" },
    });
    expect(requests[0]?.url).toContain("/api/v1/devices/push-token");

    // C2's logout reads the same secure-store key and sends DELETE with the token in a JSON body.
    await authService.logout();
    expect(requests[1]).toMatchObject({ method: "DELETE", body: { token: "ExponentPushToken[placeholder-live]" } });
  });
});
