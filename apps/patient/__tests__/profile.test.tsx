import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

import { queryClient } from "../src/api/queryClient";
import { queryKeys } from "../src/api/keys";
import { session } from "../src/auth";
import { formatCountdown, validatePasswordForm } from "../src/account/changePasswordModel";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { live, liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

/** The captured `/auth/me` of a patient who has an address and an emergency contact on file. */
const meWithDetails = () => liveBody("me-after-update");

describe("profile (live-shaped)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());
  afterEach(() => jest.restoreAllMocks());

  describe("edit profile", () => {
    it("shows what the server holds, from /auth/me's patient object", async () => {
      const { view } = await renderSignedIn({}, meWithDetails());
      await press("Open profile");
      await press("Edit personal information");
      expect((await screen.findByLabelText("House address")).props.value).toBe("1 Placeholder Street, Lagos");
      expect(screen.getByLabelText("Contact name").props.value).toBe("Placeholder Contact");
      expect(screen.queryByText(/shows sample information/)).toBeNull();
      view.unmount();
    });

    it("sends only what changed, re-reads /auth/me, and keeps user.patient (the audit's defect)", async () => {
      let saved = false;
      const { calls, view } = await renderSignedIn(
        {
          "GET /api/v1/auth/me": () => ({ status: 200, body: saved ? { ...meWithDetails(), patient: { ...meWithDetails().patient, address: "9 New Road, Abuja" } } : meWithDetails() }),
          "PUT /api/v1/auth/profile": () => {
            saved = true;
            return liveReply("profile-update", (b) => ({ ...b, address: "9 New Road, Abuja" }));
          },
        },
        meWithDetails(),
      );
      await press("Open profile");
      await press("Edit personal information");
      await fireEvent.changeText(await screen.findByLabelText("House address"), "9 New Road, Abuja");
      await press("Update Profile Details");
      expect(await screen.findByText("Profile has been updated")).toBeTruthy();

      const put = calls.find((c) => c.method === "PUT");
      expect(put?.path).toBe("/api/v1/auth/profile");
      expect(put?.body).toEqual({ address: "9 New Road, Abuja" });
      // /auth/me was read again after the PUT, and the cached user still has its patient.
      expect(calls.filter((c) => c.method === "GET" && c.path === "/api/v1/auth/me").length).toBeGreaterThanOrEqual(2);
      const cached = queryClient.getQueryData<{ patient: { id: string; address: string } | null }>(queryKeys.me);
      expect(cached?.patient?.id).toBe(meWithDetails().patient.id);
      expect(cached?.patient?.address).toBe("9 New Road, Abuja");
      view.unmount();
    });

    it("does not claim success when the server answers 200 but keeps the old name (captured backend behaviour)", async () => {
      const { view } = await renderSignedIn(
        {
          // exactly what the live backend did: 200, and the name and phone are unchanged afterwards
          "PUT /api/v1/auth/profile": () => liveReply("profile-update"),
          "GET /api/v1/auth/me": () => ({ status: 200, body: liveBody("me-after-update") }),
        },
        meWithDetails(),
      );
      await press("Open profile");
      await press("Edit personal information");
      await type("Full name", "Placeholder Patient Edited");
      await type("Phone number", "+2340000000001");
      await press("Update Profile Details");
      expect(await screen.findByText("We couldn't save your name or your phone number yet. Your other details were saved.")).toBeTruthy();
      expect(screen.queryByText("Profile has been updated")).toBeNull();
      // the field shows what the server holds again, not the unsaved text
      expect(screen.getByLabelText("Full name").props.value).toBe("Placeholder Patient");
      view.unmount();
    });

    it("refuses a cleared field instead of pretending to clear it (the backend ignores blanks)", async () => {
      const { calls, view } = await renderSignedIn({}, meWithDetails());
      await press("Open profile");
      await press("Edit personal information");
      await type("House address", "");
      await press("Update Profile Details");
      expect(await screen.findByText("This can't be cleared yet. Change it to something else.")).toBeTruthy();
      expect(calls.some((c) => c.method === "PUT")).toBe(false);
      view.unmount();
    });
  });

  describe("change password", () => {
    const open = async (extra = {}) => {
      const rendered = await renderSignedIn(extra);
      await press("Open profile");
      await press("Change password");
      await screen.findByLabelText("Current password");
      return rendered;
    };
    const fill = async (current: string, next: string, confirm = next) => {
      await type("Current password", current);
      await type("New password", next);
      await type("Confirm new password", confirm);
      await press("Change password");
    };
    const route = (label: string) => ({ "POST /api/v1/auth/change-password": () => liveReply(label) });

    it("checks the form before calling the server", () => {
      expect(validatePasswordForm({ current: "", next: "", confirm: "" })).toEqual({
        current: "Enter your current password",
        new: "Enter a new password",
        confirm: "Please confirm your new password",
      });
      expect(validatePasswordForm({ current: "a", next: "short", confirm: "short" }).new).toBe("Password must be at least 8 characters.");
      expect(validatePasswordForm({ current: "a", next: "aaaaaaaa", confirm: "aaaaaaaa" }).new).toBe("Password is too repetitive.");
      expect(validatePasswordForm({ current: "abcdefgh1", next: "abcdefgh1", confirm: "abcdefgh1" }).new).toBe("Choose a password you are not using now.");
      expect(validatePasswordForm({ current: "abcdefgh1", next: "abcdefgh2", confirm: "abcdefgh3" }).confirm).toBe("Passwords do not match");
      expect(formatCountdown(30)).toBe("0:30");
      expect(formatCountdown(65)).toBe("1:05");
    });

    it("wrong current password (400 wrong_current_password) is shown on that field", async () => {
      const { calls, view } = await open(route("password-wrong-current"));
      await fill("Not-The-Password-9", "Placeholder-Pass-2x");
      expect(await screen.findByText("Your current password is incorrect.")).toBeTruthy();
      expect(calls.filter((c) => c.path === "/api/v1/auth/change-password")).toHaveLength(1);
      view.unmount();
    });

    it("a weak password the client let through shows the server's own words (400 weak_password)", async () => {
      const { view } = await open(route("password-weak"));
      // "abcdefgh" passes the client's rules; the captured answer is the server's verdict on a repetitive one
      await fill("Placeholder-Pass-1", "abcdefgh");
      expect(await screen.findByText(liveBody("password-weak").detail.message)).toBeTruthy();
      view.unmount();
    });

    it("the same password (400 same_password) is shown on the new password field", async () => {
      const { view } = await open(route("password-same"));
      await fill("Placeholder-Pass-1", "Placeholder-Pass-2x"); // passes the client; the server's answer is what we replay
      expect(await screen.findByText("Choose a password you are not using now.")).toBeTruthy();
      view.unmount();
    });

    it("on success the NEW token pair replaces the stored one and the person stays signed in", async () => {
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
      const { calls, view } = await open(route("password-changed"));
      await fill("Placeholder-Pass-1", "Placeholder-Pass-2x");
      await waitFor(() => expect(alert).toHaveBeenCalledWith("Password changed", "You have been signed out on your other devices.", expect.any(Array)));
      const sent = calls.find((c) => c.path === "/api/v1/auth/change-password");
      expect(sent?.body).toEqual({ current_password: "Placeholder-Pass-1", new_password: "Placeholder-Pass-2x" });
      // the captured response carries the new pair; it is what the session holds now
      const pair = liveBody("password-changed");
      expect(session.store.getState().tokens).toEqual({ accessToken: pair.access_token, refreshToken: pair.refresh_token });
      expect(session.store.getState().status).toBe("signedIn");
      // the next request already uses it
      await queryClient.refetchQueries({ queryKey: queryKeys.me });
      expect(calls.filter((c) => c.path === "/api/v1/auth/me").at(-1)?.authorization).toBe(`Bearer ${pair.access_token}`);
      view.unmount();
    });

    it("too many wrong attempts (429 with Retry-After) disables the button and counts down", async () => {
      const { view } = await open(route("password-too-many"));
      await fill("Not-The-Password-9", "Placeholder-Pass-2x");
      expect(live("password-too-many").response.retryAfter).toBe("30");
      expect(await screen.findByText(/Too many incorrect attempts\. You can try again in 0:(30|29)\./, {}, { timeout: 4000 })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Try again in 0:(30|29)/ })).toBeDisabled();
      view.unmount();
    });
  });

  describe("FAQs, About, and what is hidden", () => {
    it("opens the owner's site for FAQs and About, and shows no Terms or Privacy row", async () => {
      const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const { view } = await renderSignedIn();
      await press("Open profile");
      await press("FAQs");
      expect(open).toHaveBeenLastCalledWith("https://oaklycare.com/faq");
      await press("About us");
      expect(open).toHaveBeenLastCalledWith("https://oaklycare.com/about");
      expect(screen.queryByText(/Terms|Privacy|Cookie/i)).toBeNull();
      view.unmount();
    });
  });
});
