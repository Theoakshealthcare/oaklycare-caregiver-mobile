import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { parsePushTap, toNotification } from "../src/domain/notifications";
import { utcIso } from "../src/domain/dates";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));

describe("notifications (live-shaped)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  describe("domain", () => {
    it("reads the backend's zone-less UTC timestamps as UTC", () => {
      expect(utcIso("2026-11-07T14:45:27.465509")).toBe("2026-11-07T14:45:27.465509Z");
      expect(utcIso("2026-11-07 15:33:53.445803")).toBe("2026-11-07T15:33:53.445803Z");
      expect(utcIso("2026-11-07T14:45:27Z")).toBe("2026-11-07T14:45:27Z");
      expect(utcIso("2026-11-07T14:45:27+01:00")).toBe("2026-11-07T14:45:27+01:00");
    });

    it("maps a captured feed row, and only a booking_detail target with a booking id opens a booking", () => {
      const row = liveBody("feed-default").items[0];
      const mapped = toNotification(row);
      expect(mapped).toMatchObject({ id: row.id, type: row.type, title: row.title, read: false, bookingId: row.data.booking_id });
      expect(toNotification({ ...row, data: { target: "somewhere_new", booking_id: row.data.booking_id } }).bookingId).toBeNull();
      expect(toNotification({ ...row, data: {} }).bookingId).toBeNull();
      expect(toNotification({ ...row, read_at: "2026-11-07T15:00:00" }).read).toBe(true);
    });

    it("reads a push tap from `data` (where `type` and `notification_id` live, unlike the feed row)", () => {
      const id = "11111111-1111-4111-8111-111111111111";
      const booking = "22222222-2222-4222-8222-222222222222";
      expect(parsePushTap({ type: "caregiver_found", booking_id: booking, target: "booking_detail", notification_id: id })).toEqual({ bookingId: booking, notificationId: id });
      expect(parsePushTap({ booking_id: booking, target: "booking_detail" })).toEqual({ bookingId: booking, notificationId: null });
      expect(parsePushTap({ booking_id: booking, target: "elsewhere" })).toBeNull();
      expect(parsePushTap(null)).toBeNull();
    });
  });

  it("shows the unread count on the bell, from the captured feed's unread_count", async () => {
    const { view } = await renderSignedIn({ "GET /api/v1/patient/notifications": () => liveReply("feed-page-1") });
    expect(await screen.findByRole("button", { name: "Notifications, 7 unread" })).toBeTruthy();
    view.unmount();
  });

  it("lists the captured feed (no sample notice), including a type it has never seen", async () => {
    const { view } = await renderSignedIn({ "GET /api/v1/patient/notifications": () => liveReply("feed-default") });
    await press(/^Notifications/);
    expect(await screen.findByText("Something new")).toBeTruthy();
    expect(screen.getByText("A kind of notice this app has never seen.")).toBeTruthy();
    expect(screen.getByText("Caregiver found")).toBeTruthy();
    expect(screen.getByText("Booking confirmed")).toBeTruthy();
    expect(screen.queryByText(/shows sample information/)).toBeNull();
    view.unmount();
  });

  it("marks a row read on tap and opens its booking", async () => {
    const feed = liveBody("feed-default");
    const row = feed.items[1]; // caregiver_found? whichever: the second newest
    const read = liveBody("read-one");
    const { calls, view } = await renderSignedIn({
      "GET /api/v1/patient/notifications": () => liveReply("feed-default"),
      [`POST /api/v1/patient/notifications/${row.id}/read`]: () => ({ status: 200, body: { ...read, id: row.id } }),
    });
    await press(/^Notifications/);
    await fireEvent.press(await screen.findByRole("button", { name: `Unread. ${row.title}` }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith(`/${row.id}/read`))).toBe(true));
    // BookingDetails is still sample-backed until the booking slice lands: the uuid is unknown to it, but the screen opened.
    expect(await screen.findByText("Booking details")).toBeTruthy();
    view.unmount();
  });

  it("marks everything read with one call and drops the button once nothing is unread", async () => {
    let readAll = false;
    const { calls, view } = await renderSignedIn({
      "GET /api/v1/patient/notifications": () =>
        readAll
          ? liveReply("feed-default", (b) => ({ ...b, unread_count: 0, items: b.items.map((i: any) => ({ ...i, read_at: "2026-11-07T15:00:00" })) }))
          : liveReply("feed-default"),
      "POST /api/v1/patient/notifications/read-all": () => {
        readAll = true;
        return liveReply("read-all");
      },
    });
    await press(/^Notifications/);
    await fireEvent.press(await screen.findByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull());
    expect(calls.filter((c) => c.path.endsWith("/read-all"))).toHaveLength(1);
    view.unmount();
  });

  it("pages with limit and offset: the next page is asked for at the number of rows already shown", async () => {
    const { calls, view } = await renderSignedIn({
      "GET /api/v1/patient/notifications": (call) =>
        call.search.includes("offset=7")
          ? liveReply("feed-page-2", (b) => ({ ...b, offset: 7, total: 8, items: [{ ...b.items[0], id: "33333333-3333-4333-8333-333333333333", title: "An older notice" }] }))
          : liveReply("feed-default", (b) => ({ ...b, total: 8 })),
    });
    await press(/^Notifications/);
    await screen.findByText("Something new");
    expect(calls.some((c) => c.search === "?limit=20&offset=0")).toBe(true);
    await press("Show older");
    expect(await screen.findByText("An older notice")).toBeTruthy();
    expect(calls.some((c) => c.search === "?limit=20&offset=7")).toBe(true);
    // the whole feed is shown now, so there is nothing more to ask for
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull();
    view.unmount();
  });

  it("says so, and can retry, when the feed cannot be loaded", async () => {
    let fail = true;
    const { view } = await renderSignedIn({
      "GET /api/v1/patient/notifications": () => (fail ? { status: 403, body: liveBody("feed-as-caregiver") } : liveReply("feed-default")),
    });
    await press(/^Notifications/);
    expect(await screen.findByText("We couldn't load your notifications")).toBeTruthy();
    fail = false;
    await press("Try again");
    expect(await screen.findByText("Something new")).toBeTruthy();
    view.unmount();
  });
});
