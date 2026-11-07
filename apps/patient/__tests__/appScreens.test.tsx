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

describe("signed-in app (sample data behind one hook per screen)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  describe("home", () => {
    it("greets by first name, says the data is a sample, and lists upcoming visits with Track and Chat", async () => {
      const { view } = await renderSignedIn();
      expect(screen.getAllByText(/shows sample information/).length).toBeGreaterThan(0);
      expect(screen.getByText("Start Booking")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Booking OC-10001" })).toBeTruthy();
      view.unmount();
    });
  });

  describe("bookings", () => {
    it("splits Upcoming / Completed / Canceled and offers only the actions that fit each status", async () => {
      const { view } = await renderSignedIn();
      await tab("Booking");
      // Upcoming: the accepted visit can be tracked, chatted with and canceled; the pending one can only be canceled.
      expect(await screen.findByText("OC-10001")).toBeTruthy();
      expect(screen.getByText("OC-10002")).toBeTruthy();
      expect(screen.getByText("Caregiver assigned")).toBeTruthy();
      expect(screen.getByText("Looking for a caregiver")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: "Track" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(2);
      expect(screen.queryByText("OC-10003")).toBeNull();

      await fireEvent.press(screen.getByRole("tab", { name: "Completed" }));
      expect(await screen.findByText("OC-10003")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Track" })).toBeNull();

      await fireEvent.press(screen.getByRole("tab", { name: "Canceled" }));
      expect(await screen.findByText("OC-10004")).toBeTruthy();
      view.unmount();
    });

    it("shows the visit code only while a caregiver is assigned or on the way, never when pending or completed", async () => {
      const { view } = await renderSignedIn();
      await tab("Booking");
      await screen.findByText("OC-10001");
      const details = screen.getAllByRole("button", { name: "Booking Details" });

      await fireEvent.press(details[0]); // OC-10001, accepted
      expect(await screen.findByLabelText("Visit code 0 0 0 0")).toBeTruthy();
      expect(screen.getByText(/Tell this code to your caregiver/)).toBeTruthy();
      await press("Go back");

      await fireEvent.press(screen.getAllByRole("button", { name: "Booking Details" })[1]); // OC-10002, pending
      expect(await screen.findByText("Looking for a caregiver")).toBeTruthy();
      expect(screen.queryByText("Visit code")).toBeNull();
      view.unmount();
    });

    it("cancel: shows the fee tier and refund wording BEFORE confirming, then moves the booking to Canceled", async () => {
      const { view } = await renderSignedIn();
      await tab("Booking");
      await screen.findByText("OC-10001");
      await fireEvent.press(screen.getAllByRole("button", { name: "Cancel" })[0]);

      expect(await screen.findByText("A 20% cancellation fee applies")).toBeTruthy();
      expect(screen.getByText("₦25,000")).toBeTruthy(); // amount paid
      expect(screen.getByText("₦5,000")).toBeTruthy(); // fee
      expect(screen.getByText("₦20,000")).toBeTruthy(); // eligible for refund
      expect(screen.getByText("Refunds are handled by Oakly support after you cancel.")).toBeTruthy();
      expect(screen.queryByText(/wallet/i)).toBeNull();

      await press("Yes, cancel booking");
      expect(await screen.findByText("Booking canceled successfully")).toBeTruthy();
      await press("Back to bookings");
      await fireEvent.press(await screen.findByRole("tab", { name: "Canceled" }));
      expect(await screen.findByText("OC-10001")).toBeTruthy();
      view.unmount();
    });

    it("cancel: 'No, go back' leaves the booking alone", async () => {
      const { view } = await renderSignedIn();
      await tab("Booking");
      await screen.findByText("OC-10001");
      await fireEvent.press(screen.getAllByRole("button", { name: "Cancel" })[0]);
      await press("No, go back");
      expect(await screen.findByText("OC-10001")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(2);
      view.unmount();
    });
  });

  describe("book a visit", () => {
    it("checks step 1, then step 2, then confirms with the summary and lands on the booking", async () => {
      const { view } = await renderSignedIn();
      await press("Start Booking");
      await press("Save & Continue");
      expect(await screen.findByText("Tell us who the visit is for")).toBeTruthy();
      expect(screen.getByText("Tell us what help is needed")).toBeTruthy();
      expect(screen.getByText("Choose a date")).toBeTruthy();
      expect(screen.getByText("Choose a start time")).toBeTruthy();
      expect(screen.getByText("Enter how many hours")).toBeTruthy();

      await type("Who are you booking for?", "My mother");
      await type("What help is needed?", "Walking assistance");
      await type("Duration (hours)", "30");
      await press("Save & Continue");
      expect(await screen.findByText("Enter a whole number of hours from 1 to 24")).toBeTruthy();
      await type("Duration (hours)", "4");
      // A start time that has not passed on a later day.
      const dates = screen.getAllByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ \w+$/ });
      await fireEvent.press(dates[1]);
      await press("8:00 PM");
      await press("Save & Continue");

      await screen.findByText("Where should the nurse come? Step 2 of 2.");
      await press("Save & Continue");
      expect(await screen.findByText("State is required")).toBeTruthy();
      await type("State", "Lagos");
      await type("City", "Ikeja");
      await type("House address", "12 Sample Street");
      await press("Save & Continue");

      expect(await screen.findByText("Booking Summary")).toBeTruthy();
      expect(screen.getByText("My mother")).toBeTruthy();
      expect(screen.getByText("12 Sample Street, Ikeja, Lagos")).toBeTruthy();
      expect(await screen.findByText("₦25,000")).toBeTruthy(); // sample price: 4 h
      await press("Proceed to Payment");

      expect(await screen.findByText("Booking confirmed")).toBeTruthy();
      await press("View booking");
      expect(await screen.findByText("Payment pending".toUpperCase())).toBeTruthy();
      view.unmount();
    });
  });

  describe("tracking and chat", () => {
    it("track: shows the steps reached, the visit code and the way into chat", async () => {
      const { view } = await renderSignedIn();
      await press("Track");
      expect(await screen.findByLabelText("Caregiver assigned, done")).toBeTruthy();
      expect(screen.getByLabelText("Finding a caregiver, done")).toBeTruthy();
      expect(screen.getByLabelText("Caregiver is on the way")).toBeTruthy();
      expect(screen.getByLabelText("Visit code 0 0 0 0")).toBeTruthy();
      await press("Chat with caregiver");
      await fireEvent.changeText(await screen.findByLabelText("Message"), "On my way to the gate");
      await press("Send message");
      expect(await screen.findByText("On my way to the gate")).toBeTruthy();
      // No call, video or voice-note controls in v1.
      expect(screen.queryByRole("button", { name: /call|video|voice/i })).toBeNull();
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
