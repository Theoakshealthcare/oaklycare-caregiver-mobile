import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

import { queryClient } from "../src/api/queryClient";
import { queryKeys } from "../src/api/keys";
import { session } from "../src/auth";
import { hideToast } from "../src/components/ui/toast";
import { formatCountdown, validatePasswordForm } from "../src/account/changePasswordModel";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { live, liveBody, liveReply } from "../test-utils/live";
import { capture } from "../test-utils/captures";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));

const WebBrowser = jest.requireMock("expo-web-browser") as { openBrowserAsync: jest.Mock };

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

/** The captured `/auth/me` of a patient who has an address and an emergency contact on file. */
const meWithDetails = () => liveBody("me-after-update");

describe("profile (live-shaped)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());
  // The toast host is one global store that keeps a message for 3 seconds: start every test without a leftover one.
  beforeEach(() => hideToast());
  afterEach(() => jest.restoreAllMocks());

  describe("edit profile", () => {
    it("shows what the server holds, from /auth/me's patient object", async () => {
      const { view } = await renderSignedIn({}, meWithDetails());
      await press("Open profile");
      await press("Edit Personal Information");
      expect((await screen.findByLabelText("House Address")).props.value).toBe("1 Placeholder Street, Lagos");
      expect(screen.getByLabelText("Emergency Contact Person Name").props.value).toBe("Placeholder Contact");
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
      await press("Edit Personal Information");
      await fireEvent.changeText(await screen.findByLabelText("House Address"), "9 New Road, Abuja");
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

    it("saves the name and phone for real: sends what was typed, re-reads /auth/me and shows what the server kept (phone without spaces)", async () => {
      const put = capture("pv-100-profile-save");
      const after = capture("pv-101-me-after-profile-save");
      let saved = false;
      const { calls, view } = await renderSignedIn(
        {
          "PUT /api/v1/auth/profile": () => {
            saved = true;
            return { status: put.status, body: put.body };
          },
          "GET /api/v1/auth/me": () => ({ status: 200, body: saved ? after.body : meWithDetails() }),
        },
        meWithDetails(),
      );
      await press("Open profile");
      await press("Edit Personal Information");
      await type("Full Name", "  Placeholder Patient Edited  ");
      await type("Phone Number", "0801 234 5678");
      await press("Update Profile Details");
      expect(await screen.findByText("Profile has been updated")).toBeTruthy();
      expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ full_name: "Placeholder Patient Edited", phone_number: "+2348012345678" });
      // The boxes show what the server holds now: trimmed name, phone with the separators removed (captured behaviour).
      expect(screen.getByLabelText("Full Name").props.value).toBe("Placeholder Patient Edited");
      expect(screen.getByLabelText("Phone Number").props.value).toBe("+2340000718205");
      expect(screen.queryByText(/couldn't save/)).toBeNull();
      view.unmount();
    });

    it("shows the server's own sentence under the phone for a bad number (422 list, detail[0].msg) and keeps what was typed", async () => {
      const refused = capture("pv-108-profile-bad-phone");
      expect(refused.status).toBe(422);
      const { view } = await renderSignedIn({ "PUT /api/v1/auth/profile": () => ({ status: refused.status, body: refused.body }) }, meWithDetails());
      await press("Open profile");
      await press("Edit Personal Information");
      await type("Phone Number", "12");
      await press("Update Profile Details");
      expect(await screen.findByText(refused.body.detail[0].msg)).toBeTruthy();
      expect(screen.getByLabelText("Phone Number").props.value).toBe("+23412");
      expect(screen.queryByText("Profile has been updated")).toBeNull();
      view.unmount();
    });

    it("a phone another account uses (409 phone_number_taken) is said under the phone, in the server's words", async () => {
      const refused = capture("pv-111-profile-phone-taken");
      expect(refused.status).toBe(409);
      const { view } = await renderSignedIn({ "PUT /api/v1/auth/profile": () => ({ status: refused.status, body: refused.body }) }, meWithDetails());
      await press("Open profile");
      await press("Edit Personal Information");
      await type("Phone Number", "+2340000718205");
      await press("Update Profile Details");
      expect(await screen.findByText("That phone number is already used by another account.")).toBeTruthy();
      view.unmount();
    });

    it("a refusal the server does not tie to a field (400 email_change_not_supported) opens a dialog with its message", async () => {
      const refused = capture("pv-104-profile-email-change");
      expect(refused.status).toBe(400);
      const { view } = await renderSignedIn({ "PUT /api/v1/auth/profile": () => ({ status: refused.status, body: refused.body }) }, meWithDetails());
      await press("Open profile");
      await press("Edit Personal Information");
      await type("House Address", "9 New Road, Abuja");
      await press("Update Profile Details");
      expect(await screen.findByText("Could not save")).toBeTruthy();
      expect(screen.getByText(refused.body.detail.message)).toBeTruthy();
      expect(screen.getByText("To change your email, contact support.")).toBeTruthy();
      view.unmount();
    });

    it("refuses an emptied phone box on the screen (a phone is removed on purpose, never by a blank)", async () => {
      const { calls, view } = await renderSignedIn({}, { ...meWithDetails(), phone_number: "+2340000718205" });
      await press("Open profile");
      await press("Edit Personal Information");
      await type("Phone Number", "");
      await press("Update Profile Details");
      expect(await screen.findByText("Enter a phone number, or leave it as it is.")).toBeTruthy();
      expect(calls.some((c) => c.method === "PUT")).toBe(false);
      view.unmount();
    });

    it("refuses a cleared field instead of pretending to clear it (the backend ignores blanks)", async () => {
      const { calls, view } = await renderSignedIn({}, meWithDetails());
      await press("Open profile");
      await press("Edit Personal Information");
      await type("House Address", "");
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
      await press("Edit Personal Information");
      await press("Update Password");
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
      // The app's own card dialog, never the native alert (P1-12); OK closes it and goes back to the profile.
      expect(await screen.findByText("Password changed")).toBeTruthy();
      expect(screen.getByText("You have been signed out on your other devices.")).toBeTruthy();
      expect(alert).not.toHaveBeenCalled();
      const sent = calls.find((c) => c.path === "/api/v1/auth/change-password");
      expect(sent?.body).toEqual({ current_password: "Placeholder-Pass-1", new_password: "Placeholder-Pass-2x" });
      // the captured response carries the new pair; it is what the session holds now
      const pair = liveBody("password-changed");
      expect(session.store.getState().tokens).toEqual({ accessToken: pair.access_token, refreshToken: pair.refresh_token });
      expect(session.store.getState().status).toBe("signedIn");
      // the next request already uses it
      await queryClient.refetchQueries({ queryKey: queryKeys.me });
      expect(calls.filter((c) => c.path === "/api/v1/auth/me").at(-1)?.authorization).toBe(`Bearer ${pair.access_token}`);
      await press("OK");
      await waitFor(() => expect(screen.queryByLabelText("Current password")).toBeNull());
      alert.mockRestore();
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

  describe("FAQs and About", () => {
    beforeEach(() => WebBrowser.openBrowserAsync.mockClear());

    it("opens the owner's site for FAQs and About in the in-app browser (not Safari)", async () => {
      const safari = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const { view } = await renderSignedIn();
      await press("Open profile");
      await press("FAQs");
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith("https://oaklycare.com/faq", expect.anything()));
      await press("About Us");
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith("https://oaklycare.com/about", expect.anything()));
      expect(safari).not.toHaveBeenCalled();
      safari.mockRestore();
      view.unmount();
    });

    it("falls back to the phone's browser only if the in-app one cannot open", async () => {
      WebBrowser.openBrowserAsync.mockRejectedValueOnce(new Error("no browser"));
      const safari = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const { view } = await renderSignedIn();
      await press("Open profile");
      await press("FAQs");
      await waitFor(() => expect(safari).toHaveBeenCalledWith("https://oaklycare.com/faq"));
      safari.mockRestore();
      view.unmount();
    });
  });
});
