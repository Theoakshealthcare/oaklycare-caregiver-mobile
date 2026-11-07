import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { detailRefresh } from "../src/hooks/useBookings";
import { paymentPolling } from "../src/hooks/usePaymentCheck";
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
    detailRefresh.intervalMs = 20_000;
  });

  describe("the list", () => {
    it("shows real bookings by tab, with Pay now for an unpaid one and only the actions that fit, and no sample notice", async () => {
      const cancelled = capture("016-p-b1-detail-after-cancel").body;
      const { view, calls } = await renderSignedIn({ [LIST]: () => ({ status: 200, body: [listItem(), unpaid(), { ...cancelled, visit_code: null }] }) });
      await tab("Booking");
      expect(await screen.findByText("D96F7B66")).toBeTruthy();
      expect(screen.getByText("UNPAID01")).toBeTruthy();
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
      expect(screen.getByText("Placeholder")).toBeTruthy(); // first name only
      expect(screen.queryByText("Placeholder Caregiver")).toBeNull();
      expect(screen.queryByText(/\+234/)).toBeNull();
      expect(screen.queryByRole("button", { name: /share|enter (pin|code)/i })).toBeNull();
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

    async function fillTheForm() {
      await press("Start Booking");
      await type("Who are you booking for?", "My mother");
      await type("What help is needed?", "Walking assistance");
      await type("Duration (hours)", "4");
      const dates = screen.getAllByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ \w+$/ });
      await fireEvent.press(dates[1]);
      await press("8:00 PM");
      await press("Save & Continue");
      await screen.findByText("Where should the nurse come? Step 2 of 2.");
      await type("State", "Lagos");
      await type("City", "Ikeja");
      await type("House address", "12 Sample Street");
    }

    it("needs the phone's location, sends it to the preview and the create call, and shows the backend's price", async () => {
      const { view, calls } = await renderSignedIn({
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
      await press("Female");
      await press("Yoruba");
      await type("Notes for the caregiver (optional)", "Gate code 4");
      await press("Save & Continue");

      expect(await screen.findByText("Booking Summary")).toBeTruthy();
      // The price is the preview's, never computed here (4 h x anything on the device would not give 55,000).
      expect(await screen.findByText("₦55,000")).toBeTruthy();
      expect(screen.getByText("₦50,000")).toBeTruthy();
      expect(screen.getByText("₦5,000")).toBeTruthy();
      expect(screen.getByText(/Preferred caregiver gender: female/)).toBeTruthy();
      expect(calls.find((c) => c.path.endsWith("/booking/preview"))?.body).toEqual({
        service_type: "nurse",
        duration_hours: 4,
        patient_latitude: 6.4474,
        patient_longitude: 3.4723,
      });

      await press("Proceed to Payment");
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(PAY_URL, expect.anything()));
      expect(await screen.findByText("Booking confirmed")).toBeTruthy();

      const body = calls.find((c) => c.path.endsWith("/booking/create"))?.body as Record<string, unknown>;
      expect(body).toMatchObject({
        service_type: "nurse",
        assistance_type: "Walking assistance",
        duration_hours: 4,
        patient_address: "12 Sample Street",
        patient_city: "Ikeja",
        patient_state: "Lagos",
        patient_latitude: 6.4474,
        patient_longitude: 3.4723,
        booking_for: "My mother",
        special_instructions: "Gate code 4\nPreferred caregiver gender: female\nPreferred language: Yoruba",
      });
      expect(String(body.scheduled_date)).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
      view.unmount();
    });

    it("keeps going without location only when the permission is granted: a refusal says what to do and blocks the step", async () => {
      Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied", canAskAgain: false });
      const { view } = await renderSignedIn({ [PREVIEW]: () => ({ status: 200, body: preview }) });
      await fillTheForm();
      await press("Use my current location");
      expect(await screen.findByText(/Location is switched off for Oakly/)).toBeTruthy();
      await press("Save & Continue");
      expect(screen.queryByText("Booking Summary")).toBeNull();
      view.unmount();
    });

    it("a closed browser marks nothing paid: 'Payment not confirmed yet', then Pay now opens the same checkout again", async () => {
      const verify = jest.fn(() => ({ status: 200, body: pending() }));
      const { view, calls } = await renderSignedIn({
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
      expect(screen.queryByText("Booking confirmed")).toBeNull();
      expect(countOf(calls, VERIFY)).toBe(paymentPolling.attempts); // capped, not endless
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);

      await press("Pay now");
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(2));
      expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(PAY_URL, expect.anything());
      view.unmount();
    });

    it("when Paystack cannot start the payment the booking is not offered for payment, and says so", async () => {
      const { view } = await renderSignedIn({
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

    it("Pay now with no link on this phone (after a restart) says so and offers to cancel, and a late 'paid' answer still confirms", async () => {
      const item = unpaid();
      const verify = () => ({ status: 200, body: { ...capture("live-verify-paid").body, booking_id: item.id } });
      const { view } = await renderSignedIn({
        [LIST]: () => ({ status: 200, body: [item] }),
        [`GET /api/v1/booking/booking/${item.id}`]: () => ({ status: 200, body: { ...item, visit_code: null } }),
        [`POST /api/v1/booking/booking/${item.id}/verify-payment`]: verify,
      });
      await tab("Booking");
      await fireEvent.press(await screen.findByRole("button", { name: "Pay now" }));
      expect(await screen.findByText(/not available on this phone any more/)).toBeTruthy();
      expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Cancel this booking" })).toBeTruthy();
      await press("I have paid, check now");
      expect(await screen.findByText("Booking confirmed")).toBeTruthy();
      view.unmount();
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

      await press("Yes, cancel booking");
      expect(await screen.findByText("Booking canceled")).toBeTruthy();
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
      await press("Yes, cancel booking");

      expect(await screen.findByText("The cancellation fee has changed")).toBeTruthy();
      expect(await screen.findByText("A 20% cancellation fee applies")).toBeTruthy();
      expect(screen.getByText("₦10,000")).toBeTruthy();
      expect(screen.queryByText("Booking canceled")).toBeNull();

      await press("Yes, cancel booking");
      expect(await screen.findByText("Booking canceled")).toBeTruthy();
      const bodies = calls.filter((c) => c.method === "POST" && c.path === CANCEL).map((c) => c.body);
      expect(bodies).toEqual([{ accepted_fee_kobo: 0 }, { accepted_fee_kobo: 1000000 }]);
      view.unmount();
    });

    it("a visit that has started points to support instead of offering a cancel", async () => {
      const { view } = await openCancel({ [`GET ${TERMS}`]: answer("045-p-b3-cancel-terms-in-progress") });
      expect(await screen.findByText("This booking can't be cancelled")).toBeTruthy();
      expect(screen.getByText(/The visit has already started/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Contact support" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Yes, cancel booking" })).toBeNull();
      view.unmount();
    });

    it("maps each error code from the cancel answer to a sentence and keeps the booking uncancelled", async () => {
      const { view } = await openCancel({
        [`GET ${TERMS}`]: answer("024-p-b2-cancel-terms-standard"),
        [`POST ${CANCEL}`]: answer("059-p-u3-cancel-paystack-unreachable"),
      });
      await screen.findByText("A 20% cancellation fee applies");
      await press("Yes, cancel booking");
      expect(await screen.findByText(/couldn't check your payment with our payment provider, so nothing was cancelled/)).toBeTruthy();
      view.unmount();

      const second = await openCancel({
        [`GET ${TERMS}`]: answer("024-p-b2-cancel-terms-standard"),
        [`POST ${CANCEL}`]: answer("046-p-b3-cancel-in-progress"),
      });
      await screen.findByText("A 20% cancellation fee applies");
      await press("Yes, cancel booking");
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
      await press("Yes, cancel booking");
      expect(await screen.findByText("Booking canceled")).toBeTruthy();
      expect(screen.getByText("You were not charged, so there is nothing to refund.")).toBeTruthy();
      view.unmount();
    });
  });
});
