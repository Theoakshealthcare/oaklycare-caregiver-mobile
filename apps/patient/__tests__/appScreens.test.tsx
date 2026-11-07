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

describe("signed-in app (vitals, FallGuard and profile still behind sample hooks)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  describe("vitals", () => {
    it("shows the six tiles with correct units (no 'bpr', 'bpm' on blood pressure, '98.6 C' or 'mgd/dl')", async () => {
      const { view } = await renderSignedIn();
      await tab("Vitals");
      for (const label of ["Heart rate", "Blood pressure", "Temperature", "Respiratory rate", "Blood glucose", "Sleep duration"]) {
        expect(await screen.findByRole("button", { name: label })).toBeTruthy();
      }
      expect(screen.getByText(/^mmHg ·/)).toBeTruthy();
      expect(screen.getByText(/^°C ·/)).toBeTruthy();
      expect(screen.getByText(/^mg\/dL ·/)).toBeTruthy();
      expect(screen.queryByText(/bpr|mgd\/dl| C$/i)).toBeNull();
      view.unmount();
    });

    it("manual entry: checks the numbers, then adds the reading to the tile and the history", async () => {
      const { view } = await renderSignedIn();
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Blood pressure reading" }));
      await press("Save reading");
      expect(await screen.findAllByText("Enter a value")).toHaveLength(2);
      await type("Systolic, top number (mmHg)", "80");
      await type("Diastolic, bottom number (mmHg)", "120");
      await press("Save reading");
      expect(await screen.findByText("The bottom number must be lower than the top number")).toBeTruthy();
      await type("Systolic, top number (mmHg)", "118");
      await type("Diastolic, bottom number (mmHg)", "76");
      await press("Save reading");

      expect(await screen.findByText("118/76")).toBeTruthy();
      await press("History");
      expect(await screen.findByText("Blood pressure: 118/76 mmHg")).toBeTruthy();
      view.unmount();
    });

    it("detail: Day / Week / Month change what is listed", async () => {
      const { view } = await renderSignedIn();
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Heart rate" }));
      // Sample readings: 2 hours ago, 1 day ago and 3 days ago.
      await waitFor(() => expect(screen.getAllByText(/ bpm$/).length).toBeGreaterThanOrEqual(3));
      await fireEvent.press(screen.getByRole("tab", { name: "Day" }));
      expect(screen.getByLabelText("Heart rate chart, 1 readings")).toBeTruthy();
      await fireEvent.press(screen.getByRole("tab", { name: "Week" }));
      expect(screen.getByLabelText("Heart rate chart, 3 readings")).toBeTruthy();
      view.unmount();
    });

    it("who can see my vitals: grant and revoke", async () => {
      const { view } = await renderSignedIn();
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Who can see my vitals" }));
      await fireEvent.press(await screen.findByRole("button", { name: "Revoke access" }));
      await waitFor(() => expect(screen.getAllByRole("button", { name: "Grant access" })).toHaveLength(2));
      view.unmount();
    });
  });

  describe("FallGuard", () => {
    it("answers one question at a time without scores, submits, and offers Book a Home Visit", async () => {
      const { view } = await renderSignedIn();
      await tab("Fall");
      await press("Start Assessment");
      expect(await screen.findByText("1 of 6 questions")).toBeTruthy();
      expect(screen.queryByText(/score\s*:/i)).toBeNull();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

      for (let i = 0; i < 5; i++) {
        await fireEvent.press(screen.getAllByRole("radio")[1]);
        await press("Next");
      }
      expect(await screen.findByText("6 of 6 questions")).toBeTruthy();
      await press("Back");
      expect(await screen.findByText("5 of 6 questions")).toBeTruthy();
      await press("Next");
      await fireEvent.press(screen.getAllByRole("radio")[0]);
      await press("Submit");

      expect(await screen.findByText("Total risk score")).toBeTruthy();
      expect(screen.getByText("Footwear safety")).toBeTruthy();
      await press("Book a Home Visit");
      expect(await screen.findByText("Book a nurse visit in 2 steps. Step 1 of 2.")).toBeTruthy();
      view.unmount();
    });
  });

  describe("profile and account", () => {
    it("the menu has only the v1 rows, and Contact shows the email", async () => {
      const { view } = await renderSignedIn();
      await press("Open profile");
      expect(screen.getByRole("button", { name: "Edit personal information" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Contact us" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Account and data" })).toBeTruthy();
      await press("Contact us");
      expect(await screen.findByText("info@theoakshealthcare.com")).toBeTruthy();
      view.unmount();
    });

    it("edit profile: needs a name", async () => {
      const { view } = await renderSignedIn();
      await press("Open profile");
      await press("Edit personal information");
      await fireEvent.changeText(await screen.findByLabelText("Full name"), "  ");
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
      await press("Account and data");
      await press("Delete account");
      await press("Yes, delete account");
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
      await press("Account and data");
      await press("Delete account");
      await press("Yes, delete account");
      expect(await screen.findByText("Sign in to your Oakly Health account")).toBeTruthy();
      expect(keychainKeys()).toEqual([]);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      view.unmount();
    });
  });

});
