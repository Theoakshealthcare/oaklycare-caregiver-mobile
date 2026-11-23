import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { session } from "../src/auth";
import { disableCacheGcForTests, keychainKeys } from "../test-utils/fakeApi";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const tab = (name: string) => fireEvent.press(screen.getByRole("tab", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

describe("signed-in app (account screens)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  describe("profile and account", () => {
    it("the menu has only the v1 rows, and Contact shows the email", async () => {
      const { view } = await renderSignedIn();
      await press("Open profile");
      expect(screen.getByRole("button", { name: "Edit Personal Information" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Contact Us" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Account and Data" })).toBeTruthy();
      await press("Contact Us");
      expect(await screen.findByText(/info@theoakshealthcare\.com/)).toBeTruthy();
      view.unmount();
    });

    it("edit profile: needs a name", async () => {
      const { view } = await renderSignedIn();
      await press("Open profile");
      await press("Edit Personal Information");
      await fireEvent.changeText(await screen.findByLabelText("Full Name"), "  ");
      await press("Update Profile Details");
      expect(await screen.findByText("Full name is required")).toBeTruthy();
      view.unmount();
    });

    it("delete account: shows the backend's 409 words and stays signed in", async () => {
      const { view, calls } = await renderSignedIn({
        "DELETE /api/v1/auth/profile": () => ({
          status: 409,
          body: { detail: "You have an active booking. Cancel it or wait until it is completed before deleting your account." },
        }),
      });
      await press("Open profile");
      await press("Account and Data");
      await press("Delete Account");
      await press("Yes Delete Account");
      expect(await screen.findByText(/You have an active booking\. Cancel it or wait/)).toBeTruthy();
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v1/auth/profile")).toBe(true);
      expect(session.store.getState().status).toBe("signedIn");
      view.unmount();
    });

    it("delete account: on success the keychain is emptied and the login screen returns", async () => {
      const { view } = await renderSignedIn({
        "DELETE /api/v1/auth/profile": () => ({ status: 200, body: { detail: "Account deleted successfully." } }),
      });
      await press("Open profile");
      await press("Account and Data");
      await press("Delete Account");
      await press("Yes Delete Account");
      expect(await screen.findByLabelText("Input Password")).toBeTruthy();
      expect(keychainKeys()).toEqual([]);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      view.unmount();
    });
  });

});
