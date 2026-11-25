import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import { queryClient } from "../src/api/queryClient";
import { toChatMessage, withMessage } from "../src/domain/chat";
import {
  agoText,
  distanceText,
  etaText,
  isStale,
  mapsUrl,
  STALE_AFTER_MINUTES,
  toPosition,
} from "../src/domain/tracking";
import { chatRefresh } from "../src/hooks/useChat";
import { trackingRefresh } from "../src/hooks/useTracking";
import { answer, capture } from "../test-utils/captures";
import { disableCacheGcForTests, type RecordedCall } from "../test-utils/fakeApi";
import { liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const countOf = (calls: RecordedCall[], route: string) => calls.filter((c) => `${c.method} ${c.path}` === route).length;

// Booking 2 of the backend capture run: accepted, paid. The tracking and chat bodies are `live-*` captures from the scratch
// stack (`scripts/capture-tracking-chat.mjs`); their booking ids differ, which the app never reads.
const ID = "28724045-ec58-4e31-9f5c-f7beb07f7cd2";
const LIST = "GET /api/v1/booking/patient/bookings";
const DETAIL = `GET /api/v1/booking/booking/${ID}`;
const TRACKING = `GET /api/v1/booking/booking/${ID}/live-tracking`;
const MESSAGES = `GET /api/v1/booking/chat/${ID}/messages`;
const SEND = `POST /api/v1/booking/chat/${ID}/send`;

const listAccepted = answer("023-p-bookings-list-accepted");
const detailAccepted = answer("022-p-b2-detail-accepted");
/** The same booking, on the way. */
const EN_ROUTE = capture("043-p-b3-detail-en-route").body;
const listEnRoute = () => ({ status: 200, body: [{ ...capture("023-p-bookings-list-accepted").body[0], status: "en_route" }] });
const detailEnRoute = () => ({ status: 200, body: { ...EN_ROUTE, id: ID } });
/** The captured position, reported "now" (the API's zone-less UTC string). */
const fresh = () => liveReply("tracking-accepted", (body) => ({ ...body, last_updated: new Date().toISOString().replace("Z", "") }));
const me = liveBody("chat-me");

describe("domain: tracking", () => {
  it("reads the captured live-tracking body, with the zone-less UTC time made explicit", () => {
    const body = liveBody("tracking-accepted");
    expect(body.last_updated).not.toMatch(/Z$/);
    expect(toPosition(body)).toEqual({
      latitude: 6.4774,
      longitude: 3.4723,
      distanceKm: 3.34,
      etaMinutes: 8,
      updatedAt: `${body.last_updated}Z`,
      isMoving: false,
    });
  });

  it("says how old a position is, in words that do not depend on the phone's time zone", () => {
    const at = "2026-11-07T10:00:00Z";
    const later = (seconds: number) => Date.parse(at) + seconds * 1000;
    expect(agoText(at, later(20))).toBe("just now");
    expect(agoText(at, later(60))).toBe("1 minute ago");
    expect(agoText(at, later(5 * 60 + 30))).toBe("5 minutes ago");
    expect(agoText(at, later(2 * 3600))).toBe("2 hours ago");
    expect(agoText(at, later(3 * 86400))).toBe("3 days ago");
    expect(agoText(at, later(-30))).toBe("just now");
  });

  it("calls a position stale from five minutes on", () => {
    const position = { updatedAt: "2026-11-07T10:00:00Z" };
    const base = Date.parse(position.updatedAt);
    expect(isStale(position, base + (STALE_AFTER_MINUTES * 60_000 - 1))).toBe(false);
    expect(isStale(position, base + STALE_AFTER_MINUTES * 60_000)).toBe(true);
  });

  it("writes distance and arrival time as an estimate", () => {
    expect(distanceText(3.34)).toBe("3.3 km away");
    expect(distanceText(0.82)).toBe("800 m away");
    expect(distanceText(0.01)).toBe("50 m away");
    expect(etaText(1)).toBe("about 1 minute");
    expect(etaText(8)).toBe("about 8 minutes");
    expect(etaText(65)).toBe("about 1 hour 5 minutes");
    expect(etaText(120)).toBe("about 2 hours");
  });

  it("links to the caregiver's position in the maps app", () => {
    const position = { latitude: 6.4774, longitude: 3.4723 };
    expect(mapsUrl(position, "android")).toBe("https://www.google.com/maps/search/?api=1&query=6.4774,3.4723");
    expect(mapsUrl(position, "ios")).toBe("https://maps.apple.com/?ll=6.4774,3.4723&q=Your%20caregiver");
  });
});

describe("domain: chat", () => {
  it("maps a captured message, reading sender_id as the user id and the time as UTC", () => {
    const row = liveBody("chat-list")[0];
    expect(toChatMessage(row)).toEqual({ id: row.id, senderId: row.sender_id, text: row.message, sentAt: `${row.created_at}Z` });
    expect(row.sender_id).toBe(me.id);
  });

  it("adds a sent message once, even if a refresh already brought it in", () => {
    const [first, second] = liveBody("chat-list").map(toChatMessage);
    expect(withMessage(undefined, first)).toEqual([first]);
    expect(withMessage([first], second)).toEqual([first, second]);
    expect(withMessage([first, second], second)).toEqual([first, second]);
  });
});

describe("live tracking (real calls, answered with captured bodies)", () => {
  beforeAll(() => {
    disableCacheGcForTests(queryClient);
    queryClient.setDefaultOptions({ ...queryClient.getDefaultOptions(), queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  });
  afterAll(() => queryClient.clear());
  beforeEach(() => {
    jest.clearAllMocks();
    trackingRefresh.intervalMs = 15_000;
  });

  const openTrack = async (routes: Parameters<typeof renderSignedIn>[0]) => {
    const rendered = await renderSignedIn({ [LIST]: listAccepted, [DETAIL]: detailAccepted, ...routes });
    await fireEvent.press(await screen.findByRole("button", { name: "Track" }));
    return rendered;
  };

  it("shows the distance and how fresh it is while accepted, without a guessed arrival time, and opens the maps app on tap", async () => {
    const { view, calls } = await openTrack({ [TRACKING]: fresh });
    expect(await screen.findByText("3.3 km away")).toBeTruthy();
    expect(screen.getByText("Updated just now")).toBeTruthy();
    expect(screen.getByText("Assigned")).toBeTruthy();
    expect(screen.queryByText(/Arriving in/)).toBeNull();
    expect(screen.queryByText(/shows sample information/)).toBeNull();
    expect(calls.find((c) => c.path.endsWith("/live-tracking"))?.authorization).toBe("Bearer access-stored");

    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await press("Track");
    // Jest runs as iOS (jest-expo's default platform).
    expect(open).toHaveBeenCalledWith("https://maps.apple.com/?ll=6.4774,3.4723&q=Your%20caregiver");
    open.mockRestore();
    view.unmount();
  });

  it("gives the estimated arrival once the caregiver is on the way", async () => {
    const { view } = await openTrack({ [LIST]: listEnRoute, [DETAIL]: detailEnRoute, [TRACKING]: () => liveReply("tracking-en-route") });
    expect(await screen.findByText("On the way")).toBeTruthy();
    expect(screen.getByText(/^Arriving in about \d+ minutes?$/)).toBeTruthy();
    view.unmount();
  });

  it("calls an old position out of date instead of presenting it as now", async () => {
    const { view } = await openTrack({ [TRACKING]: () => liveReply("tracking-accepted") });
    expect(await screen.findByText(/^Last position .+ ago\. It may be out of date\.$/)).toBeTruthy();
    expect(screen.queryByText(/^Updated /)).toBeNull();
    view.unmount();
  });

  it("says the location has not been shared yet when the API has no position (404)", async () => {
    const { view } = await openTrack({ [TRACKING]: () => liveReply("tracking-no-location-yet") });
    expect(await screen.findByText("Location not shared yet")).toBeTruthy();
    expect(screen.queryByText(/km away/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Track" })).toBeNull();
    view.unmount();
  });

  it("shows nothing live, and no error, when tracking is closed for the booking (409)", async () => {
    const { view } = await openTrack({ [TRACKING]: () => liveReply("tracking-after-cancel") });
    await screen.findByText("Caregiver Details");
    await waitFor(() => expect(screen.queryByText(/Looking for your caregiver/)).toBeNull());
    expect(screen.queryByText("Location not shared yet")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    view.unmount();
  });

  it("says 'Can't reach Oakly' offline, with a way to retry, and recovers", async () => {
    let offline = true;
    const { view } = await openTrack({
      [TRACKING]: () => {
        if (offline) throw new TypeError("Network request failed");
        return fresh();
      },
    });
    expect(await screen.findByText("Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
    offline = false;
    await fireEvent.press(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(await screen.findByText("3.3 km away")).toBeTruthy();
    view.unmount();
  });

  it("reads the position again on its own while the screen is open", async () => {
    trackingRefresh.intervalMs = 60;
    const { view, calls } = await openTrack({ [TRACKING]: fresh });
    await screen.findByText("3.3 km away");
    await waitFor(() => expect(countOf(calls, TRACKING)).toBeGreaterThanOrEqual(3));
    view.unmount();
  });

  it("drops the position card when the visit starts while the screen is open (the switched-off query keeps its last answer)", async () => {
    let status = "en_route";
    const { view } = await openTrack({
      [LIST]: listEnRoute,
      [DETAIL]: () => ({ status: 200, body: { ...EN_ROUTE, id: ID, status, visit_code: status === "en_route" ? EN_ROUTE.visit_code : null } }),
      [TRACKING]: () => liveReply("tracking-no-location-yet"),
    });
    expect(await screen.findByText("Location not shared yet")).toBeTruthy();
    status = "in_progress";
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["bookings", "detail", ID] });
    });
    await waitFor(() => expect(screen.queryByText("Location not shared yet")).toBeNull());
    view.unmount();
  });

  it("does not ask for a position once the visit has started", async () => {
    const started = { ...EN_ROUTE, id: ID, status: "in_progress", visit_code: null };
    const { view, calls } = await openTrack({
      [LIST]: () => ({ status: 200, body: [{ ...capture("023-p-bookings-list-accepted").body[0], status: "in_progress" }] }),
      [DETAIL]: () => ({ status: 200, body: started }),
      [TRACKING]: fresh,
    });
    expect((await screen.findAllByText("Visit in progress")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/km away/)).toBeNull();
    expect(countOf(calls, TRACKING)).toBe(0);
    view.unmount();
  });
});

describe("chat (real calls, answered with captured bodies)", () => {
  beforeAll(() => {
    disableCacheGcForTests(queryClient);
    queryClient.setDefaultOptions({ ...queryClient.getDefaultOptions(), queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  });
  afterAll(() => queryClient.clear());
  beforeEach(() => {
    jest.clearAllMocks();
    chatRefresh.intervalMs = 5_000;
  });

  const openChat = async (routes: Parameters<typeof renderSignedIn>[0]) => {
    const rendered = await renderSignedIn({ [LIST]: listAccepted, [DETAIL]: detailAccepted, ...routes }, me);
    await fireEvent.press(await screen.findByRole("button", { name: "Chat" }));
    return rendered;
  };
  const type = (value: string) => fireEvent.changeText(screen.getByLabelText("Message"), value);

  it("shows the real conversation, oldest first, with no sample notice", async () => {
    const { view, calls } = await openChat({ [MESSAGES]: () => liveReply("chat-list") });
    expect(await screen.findByText("Please call the gate when you arrive.")).toBeTruthy();
    expect(screen.getByText("Hello, I have been assigned to your visit.")).toBeTruthy();
    expect(screen.queryByText(/shows sample information/)).toBeNull();
    expect(calls.find((c) => c.path.endsWith("/messages"))?.authorization).toBe("Bearer access-stored");
    view.unmount();
  });

  it("shows the caregiver's photo (not a letter) in the chat header and message rows when the booking has one", async () => {
    const withPhoto = answer("022-p-b2-detail-accepted", (b) => ({ ...b, caregiver_details: { ...b.caregiver_details, profile_image_url: "https://img.example.com/caregiver.jpg" } }));
    const { view } = await openChat({ [DETAIL]: withPhoto, [MESSAGES]: () => liveReply("chat-list") });
    await screen.findByText("Hello, I have been assigned to your visit.");
    // the header photo, plus one beside each of the caregiver's messages (the bookings list behind may draw its own)
    expect(screen.getAllByTestId("provider-photo").length).toBeGreaterThanOrEqual(2);
    view.unmount();
  });

  it("invites the first message when the conversation is empty", async () => {
    const { view } = await openChat({ [MESSAGES]: () => liveReply("chat-empty-before-caregiver") });
    expect(await screen.findByText("No messages yet. Say hello to your caregiver.")).toBeTruthy();
    view.unmount();
  });

  it("does not draw the empty message the API will store if asked (a blank is never sent either)", async () => {
    const calls = (
      await openChat({
        [MESSAGES]: () => ({ status: 200, body: [liveBody("chat-send-blank")] }),
        [SEND]: () => liveReply("chat-send"),
      })
    ).calls;
    expect(await screen.findByText("No messages yet. Say hello to your caregiver.")).toBeTruthy();
    await type("   ");
    await press("Send message");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(countOf(calls, SEND)).toBe(0);
  });

  it("sends the trimmed text as a text message, clears the box and shows the stored message", async () => {
    const { view, calls } = await openChat({ [MESSAGES]: () => liveReply("chat-empty-before-caregiver"), [SEND]: () => liveReply("chat-send") });
    await screen.findByText("No messages yet. Say hello to your caregiver.");
    await type("  Please call the gate when you arrive.  ");
    await press("Send message");
    expect(await screen.findByText("Please call the gate when you arrive.")).toBeTruthy();
    expect(calls.find((c) => `${c.method} ${c.path}` === SEND)?.body).toEqual({ message: "Please call the gate when you arrive.", message_type: "text" });
    expect(screen.getByLabelText("Message").props.value).toBe("");
    expect(screen.queryByText("No messages yet. Say hello to your caregiver.")).toBeNull();
    view.unmount();
  });

  it("gives the words back and says so when the message could not be sent", async () => {
    const { view } = await openChat({
      [MESSAGES]: () => liveReply("chat-empty-before-caregiver"),
      [SEND]: () => {
        throw new TypeError("Network request failed");
      },
    });
    await screen.findByText("No messages yet. Say hello to your caregiver.");
    await type("Are you close?");
    await press("Send message");
    expect(await screen.findByText("Your message was not sent. Can't reach Oakly. Check your internet connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText("Message").props.value).toBe("Are you close?");
    view.unmount();
  });

  it("says a conversation of someone else's booking cannot be read (403), with a way to retry", async () => {
    const { view } = await openChat({ [MESSAGES]: () => liveReply("chat-list-other-patient") });
    expect(await screen.findByText("Access denied")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    view.unmount();
  });

  it("reads the conversation again on its own, so the caregiver's reply appears", async () => {
    chatRefresh.intervalMs = 60;
    let body = [liveBody("chat-list")[0]];
    const { view } = await openChat({ [MESSAGES]: () => ({ status: 200, body }) });
    await screen.findByText("Please call the gate when you arrive.");
    expect(screen.queryByText("Hello, I have been assigned to your visit.")).toBeNull();
    body = liveBody("chat-list");
    expect(await screen.findByText("Hello, I have been assigned to your visit.")).toBeTruthy();
    view.unmount();
  });
});
