import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";

import { queryClient } from "../src/api/queryClient";
import { registerForPush, type PushRegistrationDeps } from "../src/push/registration";
import { disableCacheGcForTests, keychainKeys } from "../test-utils/fakeApi";
import { live, liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

// A physical device whose app config has an EAS project: push is on.
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "placeholder-eas-project" } } } },
}));
jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const registerRequest = live("push-register").request.body as { token: string; platform: string };

function fakeDeps(over: Partial<PushRegistrationDeps> = {}): PushRegistrationDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    isDevice: true,
    platform: "ios",
    projectId: "placeholder-eas-project",
    ensurePermission: async () => true,
    getExpoPushToken: async () => registerRequest.token,
    storedToken: async () => null,
    storeToken: async (t) => void calls.push(`store ${t}`),
    register: async (t, p) => void calls.push(`register ${t} ${p}`),
    forget: async (t) => void calls.push(`forget ${t}`),
    log: () => undefined,
    ...over,
  };
}

describe("push registration", () => {
  describe("the pure module (copied from the caregiver app)", () => {
    it("skips quietly on a simulator and without an EAS project, and never touches the server", async () => {
      const simulator = fakeDeps({ isDevice: false });
      expect(await registerForPush(simulator)).toEqual({ status: "skipped", reason: "not_a_device" });
      const noProject = fakeDeps({ projectId: undefined });
      expect(await registerForPush(noProject)).toEqual({ status: "skipped", reason: "no_project_id" });
      expect([...simulator.calls, ...noProject.calls]).toEqual([]);
    });

    it("skips when permission is refused", async () => {
      const deps = fakeDeps({ ensurePermission: async () => false });
      expect(await registerForPush(deps)).toEqual({ status: "skipped", reason: "permission_denied" });
      expect(deps.calls).toEqual([]);
    });

    it("registers the token, and forgets the old one when Expo rotated it", async () => {
      const deps = fakeDeps({ storedToken: async () => "ExponentPushToken[placeholder-old-phone]" });
      expect(await registerForPush(deps)).toMatchObject({ status: "registered", replaced: "ExponentPushToken[placeholder-old-phone]" });
      expect(deps.calls).toEqual([
        `register ${registerRequest.token} ios`,
        `store ${registerRequest.token}`,
        "forget ExponentPushToken[placeholder-old-phone]",
      ]);
    });

    it("answers the OS token-changed event without asking the OS again, and sends nothing for a token already registered", async () => {
      const getExpoPushToken = jest.fn(async () => registerRequest.token);
      const deps = fakeDeps({ getExpoPushToken, storedToken: async () => registerRequest.token });
      expect(await registerForPush(deps, { deviceToken: "placeholder-native-token" })).toEqual({ status: "unchanged", token: registerRequest.token });
      expect(getExpoPushToken).toHaveBeenCalledWith("placeholder-eas-project", "placeholder-native-token");
      expect(deps.calls).toEqual([]);
    });

    it("an OS that fires the listener on every token request ends after one POST (staging loop, 2026-11-23)", async () => {
      const pending: Promise<unknown>[] = [];
      let stored: string | null = null;
      const deps = fakeDeps({
        storedToken: async () => stored,
        storeToken: async (t) => void (stored = t),
        getExpoPushToken: async (_projectId, deviceToken) => {
          if (!deviceToken) setTimeout(() => pending.push(registerForPush(deps, { deviceToken: "placeholder-native-token" })), 0);
          return registerRequest.token;
        },
      });
      await registerForPush(deps);
      await new Promise((resolve) => setTimeout(resolve, 20));
      await Promise.all(pending);
      expect(deps.calls.filter((c) => c.startsWith("register "))).toHaveLength(1);
    });

    it("reports a failure instead of throwing", async () => {
      const deps = fakeDeps({ register: async () => Promise.reject(new Error("offline")) });
      expect(await registerForPush(deps)).toEqual({ status: "failed" });
    });
  });

  describe("in the app", () => {
    beforeAll(() => disableCacheGcForTests(queryClient));
    afterAll(() => queryClient.clear());

    it("registers the device after sign-in with the captured request body, and forgets it on log out", async () => {
      const { calls, view } = await renderSignedIn({
        "POST /api/v1/devices/push-token": () => liveReply("push-register"),
        "DELETE /api/v1/devices/push-token": () => ({ status: 204 }),
      });
      await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/v1/devices/push-token")).toBe(true));
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/devices/push-token");
      expect(post?.body).toEqual(registerRequest);

      await fireEvent.press(screen.getByRole("button", { name: "Open profile" }));
      await fireEvent.press(await screen.findByRole("button", { name: "Account and data" }));
      await fireEvent.press(await screen.findByRole("button", { name: "Log out" }));
      await fireEvent.press(await screen.findByRole("button", { name: "Yes, log out" }));
      await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v1/devices/push-token")).toBe(true));
      expect(calls.find((c) => c.method === "DELETE")?.body).toEqual({ token: registerRequest.token });
      await waitFor(() => expect(keychainKeys()).toEqual([]));
      view.unmount();
    });

    it("opens the booking and marks the notice read when a push is tapped", async () => {
      const row = liveBody("feed-default").items[0];
      const { calls, view } = await renderSignedIn({
        "POST /api/v1/devices/push-token": () => liveReply("push-register"),
        [`POST /api/v1/patient/notifications/${row.id}/read`]: () => liveReply("read-one", (b) => ({ ...b, id: row.id })),
      });
      await waitFor(() => expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled());
      const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls.at(-1)[0];
      // what the backend's push `data` carries (guide, section 6): type and notification_id are inside `data`
      await act(async () => {
        onTap({ notification: { request: { content: { data: { type: row.type, booking_id: row.data.booking_id, target: "booking_detail", notification_id: row.id } } } } });
      });
      expect(await screen.findByText("Booking Details")).toBeTruthy();
      await waitFor(() => expect(calls.some((c) => c.path === `/api/v1/patient/notifications/${row.id}/read`)).toBe(true));
      view.unmount();
    });

    it("ignores a push that points nowhere the app knows", async () => {
      const { view } = await renderSignedIn({ "POST /api/v1/devices/push-token": () => liveReply("push-register") });
      await waitFor(() => expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled());
      const onTap = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls.at(-1)[0];
      await act(async () => {
        onTap({ notification: { request: { content: { data: { target: "something_new" } } } } });
      });
      expect(screen.queryByText("Booking Details")).toBeNull();
      view.unmount();
    });
  });
});
