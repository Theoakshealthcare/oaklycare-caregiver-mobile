import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { formatUntil } from "../src/domain/format";
import { chatRefresh } from "../src/hooks/useChat";
import { toBooking } from "../src/services/bookingMapper";
import { CHAT_CLOSED_CANCELLED, CHAT_CLOSED_VISIT_OVER } from "../src/screens/tracking/Chat";
import { answer, capture } from "../test-utils/captures";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

// The chat window rules of backend #81. The bodies are the backend's own captures (docs/fe-captures/post-visit-windows-location, copied
// as `pvw-*`); the booking captures keep only the chat/notes fields, so they are laid over the full captured detail of booking 2.
const ID = "28724045-ec58-4e31-9f5c-f7beb07f7cd2";
const LIST = "GET /api/v1/booking/patient/bookings";
const DETAIL = `GET /api/v1/booking/booking/${ID}`;
const MESSAGES = `GET /api/v1/booking/chat/${ID}/messages`;
const SEND = `POST /api/v1/booking/chat/${ID}/send`;

const listAccepted = answer("023-p-bookings-list-accepted");
const full = () => capture("022-p-b2-detail-accepted").body;
/** The captured detail with another booking's captured chat fields on it (and this booking's id). */
const detailWith = (name: string, extra: Record<string, unknown> = {}) => () => ({ status: 200, body: { ...full(), ...capture(name).body, id: ID, ...extra } });
const me = liveBody("chat-me");

describe("the chat window fields on the booking", () => {
  it("maps chat_open and chat_closes_at from the captures, the time read as UTC", () => {
    expect(toBooking(detailWith("pvw-002-p-booking-detail-chat-open")().body)).toMatchObject({ status: "completed", chatOpen: true, chatClosesAt: "2026-11-26T06:06:02.106091Z" });
    expect(toBooking(detailWith("pvw-003-p-booking-detail-chat-closed")().body)).toMatchObject({ chatOpen: false, chatClosesAt: "2026-11-25T02:06:02.124507Z" });
    expect(toBooking(detailWith("pvw-004-p-booking-detail-cancelled")().body)).toMatchObject({ status: "cancelled", chatOpen: false, chatClosesAt: null });
  });

  it("reads a booking from before the windows (no fields) as open", () => {
    expect(toBooking(full())).toMatchObject({ chatOpen: null, chatClosesAt: null });
  });

  it("writes when the chat closes in the phone's own time zone, with the day when it is not today", () => {
    const now = new Date(2026, 10, 25, 9, 0);
    expect(formatUntil(new Date(2026, 10, 25, 14, 30).toISOString(), now)).toBe("2:30 PM");
    expect(formatUntil(new Date(2026, 10, 26, 14, 30).toISOString(), now)).toBe("2:30 PM tomorrow");
    expect(formatUntil(new Date(2026, 10, 28, 0, 5).toISOString(), now)).toBe("12:05 AM on 28 Nov");
  });
});

describe("chat window (real calls, answered with captured bodies)", () => {
  beforeAll(() => {
    disableCacheGcForTests(queryClient);
    queryClient.setDefaultOptions({ ...queryClient.getDefaultOptions(), queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  });
  afterAll(() => queryClient.clear());
  beforeEach(() => {
    jest.clearAllMocks();
    chatRefresh.intervalMs = 5_000;
  });

  const openChat = async (detail: ReturnType<typeof detailWith> | (() => { status: number; body: unknown }), routes: Parameters<typeof renderSignedIn>[0] = {}) => {
    const rendered = await renderSignedIn({ [LIST]: listAccepted, [DETAIL]: detail, [MESSAGES]: () => liveReply("chat-list"), ...routes }, me);
    await fireEvent.press(await screen.findByRole("button", { name: "Chat" }));
    return rendered;
  };
  const type = (value: string) => fireEvent.changeText(screen.getByLabelText("Message"), value);

  it("keeps the message bar while the booking is in progress, with no closing-time hint", async () => {
    const { view } = await openChat(detailWith("pvw-002-p-booking-detail-chat-open", { status: "in_progress", chat_closes_at: null }));
    await screen.findByText("Hello, I have been assigned to your visit.");
    expect(screen.getByLabelText("Message")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
    expect(screen.queryByTestId("chat-closes-hint")).toBeNull();
    expect(screen.queryByTestId("chat-closed-banner")).toBeNull();
    view.unmount();
  });

  it("keeps the message bar when the API sends none of the new fields (an older backend)", async () => {
    const { view } = await openChat(() => ({ status: 200, body: full() }));
    await screen.findByText("Hello, I have been assigned to your visit.");
    expect(screen.getByLabelText("Message")).toBeTruthy();
    expect(screen.queryByTestId("chat-closed-banner")).toBeNull();
    view.unmount();
  });

  it("says when the chat closes once the visit is completed and the chat is still open", async () => {
    const closesAt = new Date(Date.now() + 5 * 3_600_000);
    const { view } = await openChat(detailWith("pvw-002-p-booking-detail-chat-open", { chat_closes_at: closesAt.toISOString().replace("Z", "") }));
    expect(await screen.findByText(new RegExp(`^You can chat until ${formatUntil(closesAt.toISOString())}$`))).toBeTruthy();
    expect(screen.getByLabelText("Message")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
    view.unmount();
  });

  it("closes the chat after the visit: no input, no send button, a calm line, the history still there", async () => {
    const { view, calls } = await openChat(detailWith("pvw-003-p-booking-detail-chat-closed"));
    expect(await screen.findByText(CHAT_CLOSED_VISIT_OVER)).toBeTruthy();
    expect(CHAT_CLOSED_VISIT_OVER).toBe("This chat has closed because the visit is over.");
    expect(screen.queryByLabelText("Message")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(screen.queryByTestId("chat-closes-hint")).toBeNull();
    // the conversation is still read and drawn
    expect(await screen.findByText("Please call the gate when you arrive.")).toBeTruthy();
    expect(calls.some((c) => `${c.method} ${c.path}` === MESSAGES)).toBe(true);
    view.unmount();
  });

  it("closes the chat of a cancelled booking with its own line, when the booking says it was cancelled", async () => {
    const { view } = await openChat(detailWith("pvw-002-p-booking-detail-chat-open"));
    await screen.findByLabelText("Message");
    // the booking is cancelled while the screen is open (the same capture the API sent: chat_open false, status cancelled)
    await act(async () => {
      queryClient.setQueryData(["bookings", "detail", ID], toBooking(detailWith("pvw-004-p-booking-detail-cancelled")().body));
    });
    expect(await screen.findByText(CHAT_CLOSED_CANCELLED)).toBeTruthy();
    expect(CHAT_CLOSED_CANCELLED).toBe("This chat is closed because the booking was cancelled.");
    expect(screen.queryByLabelText("Message")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    view.unmount();
  });

  it("switches to the closed state, not an error, when a send races the cutoff (409 chat_closed), and sends nothing more", async () => {
    const closed = capture("pvw-005-p-chat-send-closed");
    expect(closed.status).toBe(409);
    const { view, calls } = await openChat(detailWith("pvw-002-p-booking-detail-chat-open"), { [SEND]: () => closed });
    await screen.findByText("Hello, I have been assigned to your visit.");
    await type("Are you still there?");
    await fireEvent.press(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText(CHAT_CLOSED_VISIT_OVER)).toBeTruthy();
    expect(screen.queryByLabelText("Message")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(screen.queryByText(/Your message was not sent/)).toBeNull();
    expect(calls.filter((c) => `${c.method} ${c.path}` === SEND)).toHaveLength(1);
    // the booking is read again so the next visit to the screen already knows
    await waitFor(() => expect(calls.filter((c) => `${c.method} ${c.path}` === DETAIL).length).toBeGreaterThanOrEqual(2));
    view.unmount();
  });

  it("still reports any other send failure as before, with the words given back", async () => {
    const { view } = await openChat(detailWith("pvw-002-p-booking-detail-chat-open"), {
      [SEND]: () => ({ status: 500, body: { detail: "boom" } }),
    });
    await screen.findByText("Hello, I have been assigned to your visit.");
    await type("Are you close?");
    await fireEvent.press(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText(/Your message was not sent\./)).toBeTruthy();
    expect(screen.getByLabelText("Message").props.value).toBe("Are you close?");
    expect(screen.queryByTestId("chat-closed-banner")).toBeNull();
    view.unmount();
  });
});
