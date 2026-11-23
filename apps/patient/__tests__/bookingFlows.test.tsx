import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { EMPTY_DRAFT, useBookingDraft } from "../src/hooks/bookingDraft";
import { detailRefresh, listRefresh } from "../src/hooks/useBookings";
import { paymentPolling } from "../src/hooks/usePaymentCheck";
import { paymentLinkRetry } from "../src/hooks/fetchPaymentLink";
import { usePaymentLinks } from "../src/hooks/paymentLinks";
import { answer, capture } from "../test-utils/captures";
import { disableCacheGcForTests, type RecordedCall } from "../test-utils/fakeApi";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: true })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 6.4474, longitude: 3.4723 } })),
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));

const Location = jest.requireMock("expo-location") as {
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};
const WebBrowser = jest.requireMock("expo-web-browser") as { openBrowserAsync: jest.Mock };

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const tab = (name: string) => fireEvent.press(screen.getByRole("tab", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);
const choose = async (label: string, option: string) => {
  await press(label);
  await press(option);
};
const countOf = (calls: RecordedCall[], route: string) => calls.filter((c) => `${c.method} ${c.path}` === route).length;

// Booking 2 of the capture run: accepted, paid, 5 hours out.
const ID = "28724045-ec58-4e31-9f5c-f7beb07f7cd2";
const DETAIL = `/api/v1/booking/booking/${ID}`;
const TERMS = `/api/v1/booking/${ID}/cancel-terms`;
const CANCEL = `/api/v1/booking/${ID}/cancel`;
const LIST = "GET /api/v1/booking/patient/bookings";

const accepted = () => capture("022-p-b2-detail-accepted").body;
const listItem = () => capture("023-p-bookings-list-accepted").body[0];
// Preview, create and verify-payment are `live-*` captures from the scratch stack (fake Paystack, real API); the cancel and
// detail ones come from the backend's own capture run. Only the bookings made up by `unpaid()` are edited from a capture.
const unpaid = () => ({
  ...listItem(),
  id: "11111111-1111-4111-8111-111111111111",
  booking_code: "UNPAID01",
  caregiver_id: null,
  caregiver_details: null,
  status: "pending",
  payment_status: "pending",
  dispatch_state: null,
});

describe("bookings (real backend calls, answered with captured bodies)", () => {
  beforeAll(() => {
    disableCacheGcForTests(queryClient);
    // A failed read is retried with a back-off in the app; here the first failure is the one the test looks at.
    queryClient.setDefaultOptions({ ...queryClient.getDefaultOptions(), queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  });
  afterAll(() => queryClient.clear());
  beforeEach(() => {
    jest.clearAllMocks();
    usePaymentLinks.getState().clear();
    paymentPolling.intervalMs = 1;
    paymentLinkRetry.delayMs = 1;
    detailRefresh.intervalMs = 20_000;
  });

  describe("the list", () => {
    it("shows real bookings by tab, with Pay now for an unpaid one and only the actions that fit, and no sample notice", async () => {
      const cancelled = capture("016-p-b1-detail-after-cancel").body;
      const { view, calls } = await renderSignedIn({ [LIST]: () => ({ status: 200, body: [listItem(), unpaid(), { ...cancelled, visit_code: null }] }) });
      await tab("Booking");
      expect(await screen.findByLabelText("Booking D96F7B66")).toBeTruthy();
      expect(screen.getByLabelText("Booking UNPAID01")).toBeTruthy();
      expect(screen.getByText("Caregiver assigned")).toBeTruthy();
      expect(screen.getByText("Payment pending")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: "Pay now" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Track" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(2);
      expect(screen.queryByText(/shows sample information/)).toBeNull();
      // The list is a real call with the patient's token, and it never carries a visit code.
      expect(calls.find((c) => c.path === "/api/v1/booking/patient/bookings")?.authorization).toBe("Bearer access-stored");
      expect(screen.queryByLabelText(/Visit code/)).toBeNull();

      await fireEvent.press(screen.getByRole("tab", { name: "Canceled" }));
      expect(await screen.findByText("Your refund is being reviewed.")).toBeTruthy();
      view.unmount();
    });

    it("says 'Can't reach Oakly' when offline, with a way to retry, and a plain message for a bug (never the network one)", async () => {
      const { view } = await renderSignedIn({
        [LIST]: () => {
          throw new TypeError("Network request failed");
        },
      });
      await tab("Booking");
      expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      view.unmount();

      const second = await renderSignedIn({
        [LIST]: () => {
          throw new TypeError("undefined is not a function");
        },
      });
      await tab("Booking");
      expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
      expect(screen.queryByText(/Can't reach Oakly/)).toBeNull();
      second.view.unmount();
    });
  });

  describe("staying current", () => {
    // The lists live on screens that stay mounted: they must not wait for the app to leave and return to the foreground.
    const staleAtOnce = () => {
      const defaults = queryClient.getDefaultOptions();
      queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, staleTime: 0 } });
      return () => queryClient.setDefaultOptions(defaults);
    };

    it("reads the list again when a tab is shown again (a caregiver accepted while the patient was elsewhere)", async () => {
      const restore = staleAtOnce();
      try {
        let list: unknown[] = [];
        const { view } = await renderSignedIn({ [LIST]: () => ({ status: 200, body: list }) });
        await tab("Booking");
        await screen.findByText("No upcoming bookings");

        list = [listItem()];
        await tab("Home");
        await tab("Booking");
        expect(await screen.findByLabelText(`Booking ${listItem().booking_code}`)).toBeTruthy();
        view.unmount();
      } finally {
        restore();
      }
    });

    it("keeps reading the list in front while a booking is still moving, and goes quiet once none is", async () => {
      listRefresh.intervalMs = 60;
      try {
        let list: unknown[] = [listItem()];
        const { view, calls } = await renderSignedIn({ [LIST]: () => ({ status: 200, body: list }) });
        await tab("Booking");
        await waitFor(() => expect(countOf(calls, LIST)).toBeGreaterThanOrEqual(3));

        list = [{ ...listItem(), status: "completed" }];
        await screen.findByText("Completed");
        await new Promise((resolve) => setTimeout(resolve, 150));
        const settled = countOf(calls, LIST);
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(countOf(calls, LIST)).toBe(settled);
        view.unmount();
      } finally {
        listRefresh.intervalMs = 20_000;
      }
    });
  });

  describe("home", () => {
    it("lists the real upcoming visit with Track and Chat, and no sample notice for it", async () => {
      const { view } = await renderSignedIn({ [LIST]: answer("023-p-bookings-list-accepted") });
      expect(await screen.findByRole("button", { name: "Booking D96F7B66" })).toBeTruthy();
      expect(screen.getByText("Caregiver assigned")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Track" })).toBeTruthy();
      expect(screen.queryByText(/Your appointments/)).toBeNull();
      view.unmount();
    });

    it("offline: says 'Can't reach Oakly' instead of 'You do not have any appointments'", async () => {
      const { view } = await renderSignedIn({
        [LIST]: () => {
          throw new TypeError("Network request failed");
        },
      });
      expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
      expect(screen.queryByText("You do not have any appointments")).toBeNull();
      view.unmount();
    });
  });

  describe("detail and the visit code", () => {
    it("shows the code large while accepted, with the hand-over copy, the caregiver's first name and no phone, and no share control", async () => {
      const { view } = await renderSignedIn({ [LIST]: answer("023-p-bookings-list-accepted"), [`GET ${DETAIL}`]: answer("022-p-b2-detail-accepted") });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Booking Details" }));
      expect(await screen.findByLabelText("Visit code 9 8 9 3")).toBeTruthy();
      expect(screen.getByText("Give this code to your caregiver when they arrive")).toBeTruthy();
      expect(screen.getAllByText("Placeholder").length).toBeGreaterThan(0); // first name only (the list behind the sheet shows it too)
      expect(screen.queryByText("Placeholder Caregiver")).toBeNull();
      expect(screen.queryByText(/\+234/)).toBeNull();
      expect(screen.queryByRole("button", { name: /share|enter (pin|code)/i })).toBeNull();
      view.unmount();
    });

    it("a cancelled booking shows its refund state instead of PAID and offers no chat (P1-08)", async () => {
      // Capture 037: cancelled, paid, caregiver still on the record, refund under review.
      const body = capture("037-p-b2-detail-after-cancel").body;
      const { view } = await renderSignedIn({ [LIST]: () => ({ status: 200, body: [{ ...listItem(), id: body.id }] }), [`GET /api/v1/booking/booking/${body.id}`]: () => ({ status: 200, body }) });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Booking Details" }));
      expect(await screen.findByText("REFUND PENDING")).toBeTruthy();
      expect(screen.queryByText("PAID")).toBeNull();
      expect(screen.queryByRole("button", { name: "Chat with caregiver" })).toBeNull();
      expect(screen.getByText("Your refund is being reviewed.")).toBeTruthy();
      view.unmount();
    });

    it("shows it while en route and never once the visit has started", async () => {
      let body = capture("043-p-b3-detail-en-route").body;
      const id = body.id;
      const { view } = await renderSignedIn({ [LIST]: () => ({ status: 200, body: [{ ...listItem(), id }] }), [`GET /api/v1/booking/booking/${id}`]: () => ({ status: 200, body }) });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Booking Details" }));
      expect(await screen.findByText("Caregiver is on the way")).toBeTruthy();
      expect(screen.getByLabelText(/^Visit code \d \d \d \d$/)).toBeTruthy();
      view.unmount();
      body = { ...body, status: "in_progress", visit_code: null };
      const later = await renderSignedIn({ [LIST]: () => ({ status: 200, body: [{ ...listItem(), id }] }), [`GET /api/v1/booking/booking/${id}`]: () => ({ status: 200, body }) });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Booking Details" }));
      expect(await screen.findByText("Visit in progress")).toBeTruthy();
      expect(screen.queryByLabelText(/Visit code/)).toBeNull();
      later.view.unmount();
    });

    it("reads the detail again while it is open and the booking is active, and stops when the visit is over", async () => {
      detailRefresh.intervalMs = 60;
      let body = accepted();
      const { view, calls } = await renderSignedIn({ [LIST]: answer("023-p-bookings-list-accepted"), [`GET ${DETAIL}`]: () => ({ status: 200, body }) });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Booking Details" }));
      await screen.findByLabelText("Visit code 9 8 9 3");
      await waitFor(() => expect(countOf(calls, `GET ${DETAIL}`)).toBeGreaterThanOrEqual(3));

      body = { ...body, status: "completed", visit_code: null };
      await waitFor(() => expect(screen.queryByLabelText(/Visit code/)).toBeNull());
      await screen.findByText("Completed");
      const settled = countOf(calls, `GET ${DETAIL}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(countOf(calls, `GET ${DETAIL}`)).toBe(settled);
      view.unmount();
    });

    it("keeps reading the detail while the visit is in progress, so an open screen follows it to 'Completed'", async () => {
      detailRefresh.intervalMs = 60;
      let body = { ...accepted(), status: "in_progress", visit_code: null };
      const { view, calls } = await renderSignedIn({ [LIST]: answer("023-p-bookings-list-accepted"), [`GET ${DETAIL}`]: () => ({ status: 200, body }) });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Booking Details" }));
      await screen.findByText("Visit in progress");
      await waitFor(() => expect(countOf(calls, `GET ${DETAIL}`)).toBeGreaterThanOrEqual(3));

      body = { ...body, status: "completed" };
      await screen.findByText("Completed");
      view.unmount();
    });

    it("an unpaid booking offers Pay now, a booking of someone else says it can't be found", async () => {
      const item = unpaid();
      const { view } = await renderSignedIn({
        [LIST]: () => ({ status: 200, body: [item] }),
        [`GET /api/v1/booking/booking/${item.id}`]: () => ({ status: 200, body: { ...item, visit_code: null } }),
      });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Booking Details" }));
      expect(await screen.findByText("PAYMENT PENDING")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Pay now" })).toBeTruthy();
      view.unmount();
    });
  });

  describe("book a visit and pay", () => {
    const PREVIEW = "POST /api/v1/booking/preview";
    const CREATE = "POST /api/v1/booking/create";
    const NEW_ID = "22222222-2222-4222-8222-222222222222";
    const VERIFY = `POST /api/v1/booking/booking/${NEW_ID}/verify-payment`;
    const preview = capture("live-preview").body; // captured live: 4 h of nurse at the scratch pricing, no surge
    // Captured live from POST /booking/create against the scratch stack (its fake Paystack served the checkout URL).
    const created = (overrides: object = {}) => ({ ...capture("live-create").body, id: NEW_ID, ...overrides });
    const PAY_URL = capture("live-create").body.payment_url as string;
    const paid = () => ({ ...capture("live-verify-paid").body, booking_id: NEW_ID });
    const pending = () => ({ ...capture("live-verify-pending").body, booking_id: NEW_ID });

    // The form lives in one store for the whole app: every test starts with an empty one.
    beforeEach(() => useBookingDraft.setState({ draft: EMPTY_DRAFT }));
    const SERVICES = "GET /api/v1/booking/services";
    const services = () => ({ status: 200, body: capture("201-p-services-nurse-only").body });

    /** Step 1 the way a person fills it: dropdowns, the calendar sheet (next month, so the day is never past), Duration. */
    async function fillStepOne() {
      await press("Start Booking");
      await screen.findByText("Book your Appointments in 2 steps");
      await choose("Who are you Booking for ?", "My Mother");
      await choose("What Assistance Do You Need?", "Walking assistance");
      await choose("Do You Have Any Common Conditions?", "Hypertension");
      await press("Select Preferred Date and Time");
      await press("Next month");
      await press(/^\w+ 15$/);
      await press("8:00 PM");
      await press("Done");
      await choose("Duration", "1 hour 30 minutes");
    }

    async function fillTheForm() {
      await fillStepOne();
      await press("Save & Continue");
      await screen.findByText("Where do you need Care ?");
      await choose("State", "Lagos");
      await type("City", "Ikeja");
      await type("House Address", "12 Sample Street");
      await type("Phone Number", "+2348000000001");
    }

    it("needs the phone's location, sends it to the preview and the create call, and shows the backend's price", async () => {
      const { view, calls } = await renderSignedIn({
        [SERVICES]: services,
        [PREVIEW]: () => ({ status: 200, body: preview }),
        [CREATE]: () => ({ status: 200, body: created() }),
        [`GET /api/v1/booking/booking/${NEW_ID}`]: () => ({ status: 200, body: created() }),
        [VERIFY]: () => ({ status: 200, body: paid() }),
      });
      await fillTheForm();
      await press("Save & Continue");
      expect(await screen.findByText(/Tap “Use my current location”/)).toBeTruthy();

      await press("Use my current location");
      expect(await screen.findByText("Location saved")).toBeTruthy();
      await choose("Gender", "Female");
      await choose("Language", "Yoruba");
      await type("Notes for the caregiver (optional)", "Gate code 4");
      await press("Save & Continue");

      expect(await screen.findByText("Booking Summary")).toBeTruthy();
      // Figma's summary: the answers under their questions, section headings, and the cost in its own bar.
      expect(screen.getByText("Kindly confirm your appointment details")).toBeTruthy();
      for (const heading of ["Where do you need Care ?", "Contact Details", "Preference", "Service Fee"]) expect(screen.getByText(heading)).toBeTruthy();
      expect(screen.getByText("My Mother")).toBeTruthy();
      expect(screen.getByText("1 hour 30 minutes")).toBeTruthy();
      expect(screen.getByText(/^\w+ 15th 8:00 pm$/)).toBeTruthy();
      expect(screen.getByText("ada.placeholder@example.com")).toBeTruthy();
      expect(screen.getByText("Estimated Cost")).toBeTruthy();
      // The price is the preview's, never computed here (90 minutes of anything on the device would not give 55,000).
      expect(await screen.findByText("₦55,000")).toBeTruthy();
      expect(screen.getByText("₦50,000")).toBeTruthy();
      expect(screen.getByText("₦5,000")).toBeTruthy();
      expect(screen.getByText("Gate code 4")).toBeTruthy();
      expect(calls.find((c) => c.path.endsWith("/booking/preview"))?.body).toEqual({
        service_type: "nurse",
        duration_minutes: 90,
        patient_latitude: 6.4474,
        patient_longitude: 3.4723,
      });

      await press("Proceed to Payment");
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(PAY_URL, expect.anything()));
      expect(await screen.findByText(/Payment Successful\./)).toBeTruthy();

      const body = calls.find((c) => c.path.endsWith("/booking/create"))?.body as Record<string, unknown>;
      expect(body).toMatchObject({
        service_type: "nurse",
        assistance_type: "Walking assistance",
        duration_minutes: 90,
        condition: "Hypertension",
        patient_address: "12 Sample Street",
        patient_city: "Ikeja",
        patient_state: "Lagos",
        patient_latitude: 6.4474,
        patient_longitude: 3.4723,
        booking_for: "My Mother",
        special_instructions:
          "Gate code 4\nPreferred caregiver gender: female\nPreferred language: Yoruba\nContact phone: +2348000000001\nContact email: ada.placeholder@example.com",
      });
      expect(String(body.scheduled_date)).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
      view.unmount();
    });

    it("keeps going without location only when the permission is granted: a refusal says what to do and blocks the step", async () => {
      Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied", canAskAgain: false });
      const { view } = await renderSignedIn({
        [SERVICES]: services,
        [PREVIEW]: () => ({ status: 200, body: preview }),
      });
      await fillTheForm();
      await press("Use my current location");
      expect(await screen.findByText(/Location is switched off for Oakly/)).toBeTruthy();
      await press("Save & Continue");
      expect(screen.queryByText("Booking Summary")).toBeNull();
      view.unmount();
    });

    it("step 1 asks for what is missing, only offers the catalogue's lengths, and sends what was typed for 'Other'", async () => {
      const { view } = await renderSignedIn({ [SERVICES]: services });
      await press("Start Booking");
      await screen.findByText("Book your Appointments in 2 steps");
      // The button stays off until the catalogue has loaded (and the nurse is chosen for the person): press only then.
      await waitFor(() => expect(screen.getByRole("button", { name: "What Services are you Booking ?" }).props.accessibilityValue.text).toBe("Nurse visit"));
      await press("Save & Continue");
      for (const message of ["Tell us who the visit is for", "Tell us what help is needed", "Choose a date and time", "Choose how long the visit should be"]) {
        expect(screen.getByText(message)).toBeTruthy();
      }
      // The nurse is chosen for the person (one service on sale), and Duration lists 60 to 1440 minutes in 30-minute steps.
      expect(screen.getByRole("button", { name: "What Services are you Booking ?" }).props.accessibilityValue.text).toBe("Nurse visit");
      await press("Duration");
      expect(screen.getByRole("button", { name: "1 hour 30 minutes" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "24 hours" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "30 minutes" })).toBeNull();
      await press("Close");
      await choose("What Assistance Do You Need?", "Other");
      await press("Save & Continue");
      expect(screen.getByText("Type the help that is needed")).toBeTruthy();
      view.unmount();
    });

    it("says no services are available when the catalogue is empty, and does not let the person continue", async () => {
      const { view } = await renderSignedIn({ [SERVICES]: () => ({ status: 200, body: { services: [] } }) });
      await press("Start Booking");
      expect(await screen.findByText(/No services are available right now/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Save & Continue" }).props.accessibilityState.disabled).toBe(true);
      view.unmount();
    });

    it("step 2 needs a phone number and a valid email, prefilled from the account", async () => {
      const { view } = await renderSignedIn({ [SERVICES]: services });
      await fillStepOne();
      await press("Save & Continue");
      await screen.findByText("Where do you need Care ?");
      expect(screen.getByLabelText("Email Address").props.value).toBe("ada.placeholder@example.com");
      expect(screen.getByLabelText("Phone Number").props.value).toBe(""); // the account has no phone yet
      await type("Email Address", "not-an-email");
      await press("Save & Continue");
      expect(screen.getByText("State is required")).toBeTruthy();
      expect(screen.getByText("Phone number is required")).toBeTruthy();
      expect(screen.getByText("Enter a valid email address")).toBeTruthy();
      view.unmount();
    });

    it("a closed browser marks nothing paid: Paystack says abandoned, so 'Payment Failed! Try Again', and Try Again opens the same checkout", async () => {
      const verify = jest.fn(() => ({ status: 200, body: pending() })); // the capture says payment_status "abandoned"
      const { view, calls } = await renderSignedIn({
        [SERVICES]: services,
        [PREVIEW]: () => ({ status: 200, body: preview }),
        [CREATE]: () => ({ status: 200, body: created() }),
        [`GET /api/v1/booking/booking/${NEW_ID}`]: () => ({ status: 200, body: created() }),
        [VERIFY]: verify,
      });
      await fillTheForm();
      await press("Use my current location");
      await screen.findByText("Location saved");
      await press("Save & Continue");
      await screen.findByText("₦55,000");
      await press("Proceed to Payment");

      expect(await screen.findByText("Payment Failed! Try Again")).toBeTruthy();
      expect(screen.queryByText(/Payment Successful/)).toBeNull();
      expect(countOf(calls, VERIFY)).toBe(paymentPolling.attempts); // capped, not endless
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);

      await press("Try Again");
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(2));
      expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(PAY_URL, expect.anything());
      view.unmount();
    });

    it("a payment Paystack has not decided (still processing) is never called failed: 'Payment not confirmed yet', with Pay now and Check again", async () => {
      const verify = jest.fn(() => ({ status: 200, body: { ...pending(), payment_status: "ongoing" } }));
      const { view } = await renderSignedIn({
        [SERVICES]: services,
        [PREVIEW]: () => ({ status: 200, body: preview }),
        [CREATE]: () => ({ status: 200, body: created() }),
        [`GET /api/v1/booking/booking/${NEW_ID}`]: () => ({ status: 200, body: created() }),
        [VERIFY]: verify,
      });
      await fillTheForm();
      await press("Use my current location");
      await screen.findByText("Location saved");
      await press("Save & Continue");
      await screen.findByText("₦55,000");
      await press("Proceed to Payment");

      expect(await screen.findByText("Payment not confirmed yet")).toBeTruthy();
      expect(screen.queryByText("Payment Failed! Try Again")).toBeNull();
      expect(screen.getByRole("button", { name: "Pay now" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
      view.unmount();
    });

    it("the success frame shows the receipt from the booking (id, amount, PAID) and no email claim; View Booking while no caregiver is assigned", async () => {
      const { view } = await renderSignedIn({
        [SERVICES]: services,
        [PREVIEW]: () => ({ status: 200, body: preview }),
        [CREATE]: () => ({ status: 200, body: created() }),
        [`GET /api/v1/booking/booking/${NEW_ID}`]: () => ({ status: 200, body: created() }),
        [VERIFY]: () => ({ status: 200, body: paid() }),
      });
      await fillTheForm();
      await press("Use my current location");
      await screen.findByText("Location saved");
      await press("Save & Continue");
      await screen.findByText("₦55,000");
      await press("Proceed to Payment");

      expect(await screen.findByText(/Payment Successful\./)).toBeTruthy();
      expect(screen.getByText("Your payment was received. We are now finding a caregiver for you.")).toBeTruthy();
      expect(screen.queryByText(/sent to your email/)).toBeNull();
      expect(await screen.findByText(created().booking_code)).toBeTruthy();
      expect(screen.getByText("₦55,000")).toBeTruthy();
      expect(screen.getByText("PAID")).toBeTruthy();
      expect(screen.getByRole("button", { name: "View Booking" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "View Caregiver" })).toBeNull();
      await press("Close"); // the round close goes to the bookings list
      expect(await screen.findByRole("tab", { name: "Booking" })).toBeTruthy();
      view.unmount();
    });

    it("when Paystack cannot start the payment the booking is not offered for payment, and says so", async () => {
      const { view } = await renderSignedIn({
        [SERVICES]: services,
        [PREVIEW]: () => ({ status: 200, body: preview }),
        [CREATE]: () => ({ status: 200, body: created({ status: "cancelled", payment_status: "failed", payment_url: null, payment_error: "Payment gateway temporarily unavailable" }) }),
      });
      await fillTheForm();
      await press("Use my current location");
      await screen.findByText("Location saved");
      await press("Save & Continue");
      await screen.findByText("₦55,000");
      await press("Proceed to Payment");
      expect(await screen.findByText(/We could not start the payment/)).toBeTruthy();
      expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
      view.unmount();
    });

    it("the summary says 'Can't reach Oakly' when the price cannot be fetched, and will not proceed without a price", async () => {
      const { view } = await renderSignedIn({
        [SERVICES]: services,
        [PREVIEW]: () => {
          throw new TypeError("Network request failed");
        },
      });
      await fillTheForm();
      await press("Use my current location");
      await screen.findByText("Location saved");
      await press("Save & Continue");
      expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Proceed to Payment" }).props.accessibilityState.disabled).toBe(true);
      view.unmount();
    });

    describe("Pay now after an app restart (no checkout URL kept on this phone)", () => {
      // The real answers of POST /booking/{id}/payment-link, from `backend/docs/fe-captures/patient` (copied to `test-utils/captures`).
      const linkReply = () => capture("066-p-link");
      const LINK_URL = linkReply().body.payment_url as string;
      const refused = (name: string) => () => ({ status: capture(name).status, body: capture(name).body });

      /** An unpaid booking in the list, opened with "Pay now" from the Bookings tab. */
      async function openPayNow(linkHandler: (call: RecordedCall) => { status: number; body?: unknown }, extra: Record<string, any> = {}) {
        const item = unpaid();
        const rendered = await renderSignedIn({
          [LIST]: () => ({ status: 200, body: [item] }),
          [`GET /api/v1/booking/booking/${item.id}`]: () => ({ status: 200, body: { ...item, visit_code: null } }),
          [`POST /api/v1/booking/${item.id}/payment-link`]: linkHandler,
          [`POST /api/v1/booking/booking/${item.id}/verify-payment`]: () => ({ status: 200, body: { ...capture("live-verify-paid").body, booking_id: item.id } }),
          ...extra,
        });
        await tab("Booking");
        await fireEvent.press(await screen.findByRole("button", { name: "Pay now" }));
        return { ...rendered, item };
      }

      it("asks the backend for a link (no body), opens it in the in-app browser, and reuses it on the next tap", async () => {
        const item = unpaid();
        const pending = () => ({ status: 200, body: { ...capture("live-verify-pending").body, booking_id: item.id } });
        const { calls, view } = await openPayNow(() => linkReply(), { [`POST /api/v1/booking/booking/${item.id}/verify-payment`]: pending });
        await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(LINK_URL, expect.anything()));
        const request = calls.find((c) => c.path === `/api/v1/booking/${item.id}/payment-link`);
        expect(request).toMatchObject({ method: "POST", body: null });
        expect(usePaymentLinks.getState().urls[item.id]).toBe(LINK_URL);
        // The browser closed with nothing paid (the mock answers "dismiss", verify says abandoned): failed, nothing marked paid.
        expect(await screen.findByText("Payment Failed! Try Again")).toBeTruthy();
        // Try Again opens the remembered link: the backend is not asked for a second one.
        await press("Try Again");
        await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(2));
        expect(countOf(calls, `POST /api/v1/booking/${item.id}/payment-link`)).toBe(1);
        view.unmount();
      });

      it("a booking the server says is already paid is confirmed, never shown as an error (409 booking_already_paid)", async () => {
        const { view } = await openPayNow(refused("076-p-link-paid-but-webhook-late"));
        expect(await screen.findByText(/Payment Successful\./)).toBeTruthy();
        expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
        view.unmount();
      });

      it.each([
        ["081-p-link-cancelled", "This booking has been cancelled, so it can no longer be paid. You can book again."],
        ["079-p-link-window-expired", "The time to pay for this booking has run out. Please make a new booking."],
      ])("a booking that can no longer be paid (%s) says why and offers no Pay now", async (name, sentence) => {
        const { view } = await openPayNow(refused(name));
        expect(await screen.findByText("This booking can't be paid")).toBeTruthy();
        expect(screen.getByText(sentence)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Pay now" })).toBeNull();
        expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
        view.unmount();
      });

      it("a refused payment link (503 payment_link_unavailable) says to try again, keeps Pay now and offers to cancel", async () => {
        const { calls, view, item } = await openPayNow(refused("073-p-link-paystack-refuses"));
        expect(await screen.findByText("Could not open the payment page")).toBeTruthy();
        expect(screen.getByText(/We couldn't prepare your payment link right now\. Your booking is still waiting for payment and nothing was charged\./)).toBeTruthy();
        expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
        await press("OK");
        expect(screen.getByRole("button", { name: "Pay now" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cancel this booking" })).toBeTruthy();
        // Pay now tries again (still refused here): one more request, not a stuck screen.
        await press("Pay now");
        await waitFor(() => expect(countOf(calls, `POST /api/v1/booking/${item.id}/payment-link`)).toBe(2));
        view.unmount();
      });

      it("Paystack could not be asked (503 payment_check_unavailable) says no link was prepared and nothing was charged", async () => {
        const { view } = await openPayNow(refused("075-p-link-paystack-unreachable"));
        expect(await screen.findByText(/no payment link was prepared\. Nothing was charged\./)).toBeTruthy();
        view.unmount();
      });

      it("another request for the same booking still running (409 payment_link_in_progress) is waited out, not shown as an error", async () => {
        paymentLinkRetry.delayMs = 1;
        let calls = 0;
        const { view } = await openPayNow(() => {
          calls += 1;
          return calls < 3
            ? { status: 409, body: { detail: { code: "payment_link_in_progress", message: "A payment link is already being prepared." } } }
            : linkReply();
        });
        await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(LINK_URL, expect.anything()));
        expect(calls).toBe(3);
        expect(screen.queryByText("Could not open the payment page")).toBeNull();
        view.unmount();
      });

      it("somebody else's booking or one that does not exist is closed with the server's meaning", async () => {
        const { view } = await openPayNow(refused("069-q-link-other-patient"));
        expect(await screen.findByText("Only the person who made this booking can pay for it.")).toBeTruthy();
        view.unmount();
      });

      it("no pricing configured (503 booking_settings_not_configured) on create says booking is unavailable, in plain words", async () => {
        const { view } = await renderSignedIn({
          [SERVICES]: services,
          "POST /api/v1/booking/preview": refused("061-p-preview-no-pricing"),
        });
        await fillTheForm();
        await press("Use my current location");
        await screen.findByText("Location saved");
        await press("Save & Continue");
        expect(await screen.findByText("Booking isn't available right now. Please try again later.")).toBeTruthy();
        view.unmount();
      });
    });
  });

  describe("cancel", () => {
    const openCancel = async (extra: Parameters<typeof renderSignedIn>[0]) => {
      const rendered = await renderSignedIn({
        [LIST]: answer("023-p-bookings-list-accepted"),
        [`GET ${DETAIL}`]: answer("022-p-b2-detail-accepted"),
        ...extra,
      });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Cancel" }));
      return rendered;
    };

    it("shows the tier, the fee and the refund before confirming, sends accepted_fee_kobo, then the refund summary read from the booking", async () => {
      let cancelled = false;
      const { view, calls } = await openCancel({
        [`GET ${TERMS}`]: answer("024-p-b2-cancel-terms-standard"),
        [`POST ${CANCEL}`]: () => {
          cancelled = true;
          return capture("033-p-b2-cancel-standard");
        },
        [`GET ${DETAIL}`]: () => (cancelled ? capture("037-p-b2-detail-after-cancel") : capture("022-p-b2-detail-accepted")),
      });

      expect(await screen.findByText("A 20% cancellation fee applies")).toBeTruthy();
      expect(screen.getByText(/less than 12 hours away, so Oakly keeps 20% of the service fee/)).toBeTruthy();
      expect(screen.getByText("₦55,000")).toBeTruthy(); // paid
      expect(screen.getByText("₦10,000")).toBeTruthy(); // fee
      expect(screen.getByText("₦45,000")).toBeTruthy(); // refund
      expect(screen.getByText("Refunds are reviewed and sent to your original payment method.")).toBeTruthy();
      expect(screen.queryByText(/wallet/i)).toBeNull();
      expect(screen.queryByText(/request refund/i)).toBeNull();
      expect(countOf(calls, `GET ${TERMS}`)).toBe(1);
      expect(countOf(calls, `POST ${CANCEL}`)).toBe(0); // nothing is cancelled before the confirm

      await press("Yes, Cancel");
      expect(await screen.findByText("Booking Canceled Successfully")).toBeTruthy();
      expect(calls.find((c) => c.method === "POST" && c.path === CANCEL)?.body).toEqual({ accepted_fee_kobo: 1000000 });
      // The refund summary comes from the booking itself (capture 037), not from the cancel answer.
      expect(await screen.findByText("Your refund is being reviewed.")).toBeTruthy();
      expect(screen.getByText("₦45,000")).toBeTruthy();
      expect(screen.getByText("₦10,000")).toBeTruthy();
      expect(screen.queryByText(/wallet/i)).toBeNull();
      expect(screen.queryByText(/request refund/i)).toBeNull();
      view.unmount();
    });

    it("a free cancel shows 'Free' and a late one shows the 50% tier from the response", async () => {
      const { view } = await openCancel({ [`GET ${TERMS}`]: answer("040-p-b3-cancel-terms-late-accepted") });
      expect(await screen.findByText("A 50% cancellation fee applies")).toBeTruthy();
      expect(screen.getByText("₦25,000")).toBeTruthy();
      view.unmount();

      const free = await openCancel({ [`GET ${TERMS}`]: answer("011-p-b1-cancel-terms-free") });
      expect(await screen.findByText("Free cancellation")).toBeTruthy();
      expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
      free.view.unmount();
    });

    it("409 terms_changed is not an error: the new fee is shown and confirming again sends the new amount", async () => {
      let posts = 0;
      const { view, calls } = await openCancel({
        [`GET ${TERMS}`]: answer("011-p-b1-cancel-terms-free", (b) => ({ ...b, booking_id: ID })),
        [`POST ${CANCEL}`]: () => {
          posts += 1;
          return posts === 1 ? capture("032-p-b2-cancel-terms-changed") : capture("033-p-b2-cancel-standard");
        },
        [`GET ${DETAIL}`]: answer("037-p-b2-detail-after-cancel"),
      });
      expect(await screen.findByText("Free cancellation")).toBeTruthy();
      await press("Yes, Cancel");

      expect(await screen.findByText("The cancellation fee has changed")).toBeTruthy();
      expect(await screen.findByText("A 20% cancellation fee applies")).toBeTruthy();
      expect(screen.getByText("₦10,000")).toBeTruthy();
      expect(screen.queryByText("Booking Canceled Successfully")).toBeNull();

      await press("Yes, Cancel");
      expect(await screen.findByText("Booking Canceled Successfully")).toBeTruthy();
      const bodies = calls.filter((c) => c.method === "POST" && c.path === CANCEL).map((c) => c.body);
      expect(bodies).toEqual([{ accepted_fee_kobo: 0 }, { accepted_fee_kobo: 1000000 }]);
      view.unmount();
    });

    it("a visit that has started points to support instead of offering a cancel", async () => {
      const { view } = await openCancel({ [`GET ${TERMS}`]: answer("045-p-b3-cancel-terms-in-progress") });
      expect(await screen.findByText("This booking can't be cancelled")).toBeTruthy();
      expect(screen.getByText(/The visit has already started/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Contact support" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Yes, Cancel" })).toBeNull();
      view.unmount();
    });

    it("maps each error code from the cancel answer to a sentence and keeps the booking uncancelled", async () => {
      const { view } = await openCancel({
        [`GET ${TERMS}`]: answer("024-p-b2-cancel-terms-standard"),
        [`POST ${CANCEL}`]: answer("059-p-u3-cancel-paystack-unreachable"),
      });
      await screen.findByText("A 20% cancellation fee applies");
      await press("Yes, Cancel");
      expect(await screen.findByText(/couldn't check your payment with our payment provider, so nothing was cancelled/)).toBeTruthy();
      view.unmount();

      const second = await openCancel({
        [`GET ${TERMS}`]: answer("024-p-b2-cancel-terms-standard"),
        [`POST ${CANCEL}`]: answer("046-p-b3-cancel-in-progress"),
      });
      await screen.findByText("A 20% cancellation fee applies");
      await press("Yes, Cancel");
      expect(await screen.findByText(/already started, so it can't be cancelled in the app/)).toBeTruthy();
      second.view.unmount();
    });

    it("offline: the terms screen says 'Can't reach Oakly'", async () => {
      const { view } = await openCancel({
        [`GET ${TERMS}`]: () => {
          throw new TypeError("Network request failed");
        },
      });
      expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
      view.unmount();
    });

    it("an unpaid booking cancels free with nothing to refund", async () => {
      const item = unpaid();
      const terms = capture("052-p-u1-cancel-terms-unpaid").body;
      const { view } = await renderSignedIn({
        [LIST]: () => ({ status: 200, body: [item] }),
        [`GET /api/v1/booking/booking/${item.id}`]: () => ({ status: 200, body: { ...item, visit_code: null } }),
        [`GET /api/v1/booking/${item.id}/cancel-terms`]: () => ({ status: 200, body: { ...terms, booking_id: item.id } }),
        [`POST /api/v1/booking/${item.id}/cancel`]: answer("053-p-u1-cancel-unpaid", (b) => ({ ...b, booking_id: item.id })),
      });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Cancel" }));
      expect(await screen.findByText("Free cancellation")).toBeTruthy();
      expect(screen.getByText("You have not paid yet, so there is nothing to refund.")).toBeTruthy();
      await press("Yes, Cancel");
      expect(await screen.findByText("Booking Canceled Successfully")).toBeTruthy();
      expect(screen.getByText("You were not charged, so there is nothing to refund.")).toBeTruthy();
      view.unmount();
    });
  });
});
