import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import { formatUntil } from "../src/utils/dates";
import ChatScreen, { CHAT_CLOSED_CANCELLED, CHAT_CLOSED_VISIT_OVER } from "../src/screens/chat/ChatScreen";
import Chats from "../src/screens/chats/Chats";
import { chatsService, type ChatList } from "../src/services/chats.service";
import type { Booking, ChatMessage } from "../src/services/booking.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import { retimed, windowCapture } from "../test-utils/windowCaptures";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, popTo: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: jest.fn(),
}));

let mockMessages: Partial<ChatMessage>[] = [];
let mockBooking: Partial<Booking> | undefined;
const mockSend = jest.fn();
jest.mock("../src/hooks/queries", () => {
  const actual = jest.requireActual("../src/hooks/queries");
  return {
    ...actual,
    useMe: () => ({ data: { id: "me" } }),
    useChatMessages: () => ({ data: mockMessages }),
    useBooking: () => ({ data: mockBooking }),
    useSendChatMessage: () => ({ mutate: (...args: unknown[]) => mockSend(...args), isPending: false }),
  };
});
jest.mock("../src/config/voiceNotes", () => ({ voiceNotesMode: () => "off" }));

// The rows of the backend's capture `009` (a caregiver's bookings): in progress, completed 1 h ago, completed 2 h ago, completed 30 h ago.
const rows = windowCapture("009-c-bookings-notes-window").body as Record<string, unknown>[];
const [IN_PROGRESS, COMPLETED_1H, , COMPLETED_30H] = rows.map(retimed);
const CHAT_SEND_CLOSED = windowCapture("006-c-chat-send-closed");
const CONTEXT = { service_type: "nurse", assistance_type: "Wound Dressing", scheduled_date: "2026-11-25T10:00:00Z", scheduled_end_date: "2026-11-25T11:30:00Z", patient_address: "12 Placeholder Street" };
const props = () => routeProps<React.ComponentProps<typeof ChatScreen>>({ bookingId: "b1", patientName: "Placeholder Patient" });
const withBooking = (row: Record<string, unknown>) => {
  mockBooking = { ...CONTEXT, ...row } as unknown as Partial<Booking>;
};
const type = (text: string) => fireEvent.changeText(screen.getByPlaceholderText("Type a message..."), text);

beforeEach(() => {
  mockMessages = [];
  mockBooking = undefined;
  mockSend.mockReset();
  mockNavigate.mockClear();
});

describe("chat room: the chat window", () => {
  it("keeps the composer and quick replies while the visit is in progress, with no closing hint", async () => {
    withBooking(IN_PROGRESS);
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByPlaceholderText("Type a message...")).toBeTruthy();
    expect(screen.getByTestId("chat-send")).toBeTruthy();
    expect(screen.getByTestId("quick-reply-I'm on my way")).toBeTruthy();
    expect(screen.queryByTestId("chat-closes-hint")).toBeNull();
    expect(screen.queryByTestId("chat-closed-banner")).toBeNull();
  });

  it("keeps the composer when the booking carries none of the new fields (an older backend, or still loading)", async () => {
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByTestId("chat-send")).toBeTruthy();
    expect(screen.queryByTestId("chat-closed-banner")).toBeNull();
    withBooking({ status: "completed" });
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getAllByTestId("chat-send").length).toBeGreaterThan(0);
  });

  it("says when the chat closes once the visit is completed and the chat is still open", async () => {
    withBooking(COMPLETED_1H);
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByTestId("chat-closes-hint")).toHaveTextContent(`You can chat until ${formatUntil(COMPLETED_1H.chat_closes_at as string)}`);
    expect(screen.getByTestId("chat-send")).toBeTruthy();
  });

  it("closes the chat 24 h after the visit: no input, no send, no quick replies, a calm line, and the history stays", async () => {
    mockMessages = [{ id: "m1", sender_id: "them", message: "Placeholder: see you next week.", created_at: "2026-11-24T01:06:02" }];
    withBooking(COMPLETED_30H);
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByTestId("chat-closed-banner")).toHaveTextContent("This chat has closed because the visit is over.");
    expect(CHAT_CLOSED_VISIT_OVER).toBe("This chat has closed because the visit is over.");
    expect(screen.queryByPlaceholderText("Type a message...")).toBeNull();
    expect(screen.queryByTestId("chat-send")).toBeNull();
    expect(screen.queryByTestId("quick-reply-I'm on my way")).toBeNull();
    expect(screen.queryByTestId("chat-closes-hint")).toBeNull();
    expect(screen.getByText("Placeholder: see you next week.")).toBeTruthy();
  });

  it("closes a cancelled booking's chat at once, with its own line", async () => {
    withBooking({ status: "cancelled", chat_open: false, chat_closes_at: null });
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByTestId("chat-closed-banner")).toHaveTextContent("This chat is closed because the booking was cancelled.");
    expect(CHAT_CLOSED_CANCELLED).toBe("This chat is closed because the booking was cancelled.");
    expect(screen.queryByTestId("chat-send")).toBeNull();
  });

  it("switches to the closed state, with no error alert, when a send races the cutoff (409 chat_closed)", async () => {
    expect(CHAT_SEND_CLOSED.status).toBe(409);
    mockSend.mockImplementation((_text: string, options: { onError: (e: unknown) => void }) =>
      options.onError(new ApiError(CHAT_SEND_CLOSED.status, CHAT_SEND_CLOSED.body, "x")),
    );
    const alert = jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => undefined);
    withBooking(COMPLETED_1H);
    await renderWithClient(<ChatScreen {...props()} />);
    await type("Are you still there?");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await waitFor(() => expect(screen.getByTestId("chat-closed-banner")).toHaveTextContent(CHAT_CLOSED_VISIT_OVER));
    expect(screen.queryByTestId("chat-send")).toBeNull();
    expect(screen.queryByPlaceholderText("Type a message...")).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it("still alerts for any other failed send", async () => {
    mockSend.mockImplementation((_text: string, options: { onError: (e: unknown) => void }) => options.onError(new ApiError(500, { detail: "boom" }, "boom")));
    const alert = jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => undefined);
    withBooking(COMPLETED_1H);
    await renderWithClient(<ChatScreen {...props()} />);
    await type("Hello");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Message not sent", expect.any(String)));
    expect(screen.queryByTestId("chat-closed-banner")).toBeNull();
    alert.mockRestore();
  });
});

describe("Chats list: closed conversations", () => {
  beforeEach(async () => {
    await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await session.signOut();
  });

  it("labels exactly the closed chats 'Closed' (the captured list: some open, some closed)", async () => {
    const items = windowCapture("001-c-chats-list-chat-open").body.items as ChatList["items"];
    const closed = items.filter((i) => i.chat_open === false);
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.length).toBeLessThan(items.length);
    jest.spyOn(chatsService, "listChats").mockResolvedValue({ items, next_before: null, next_before_id: null });
    await renderWithClient(<Chats />);
    await screen.findByTestId(`chat-row-${items[0].booking_id}`);
    expect(screen.getAllByTestId("chat-row-closed")).toHaveLength(closed.length);
    for (const item of items) {
      const row = screen.getByTestId(`chat-row-${item.booking_id}`);
      if (item.chat_open === false) expect(row).toHaveTextContent(/Closed/);
      else expect(row).not.toHaveTextContent(/Closed/);
    }
  });

  it("shows no label when the API sends no chat_open (an older backend)", async () => {
    const [first] = windowCapture("001-c-chats-list-chat-open").body.items as Record<string, unknown>[];
    const { chat_open: _drop, chat_closes_at: _drop2, ...older } = first;
    jest.spyOn(chatsService, "listChats").mockResolvedValue({ items: [older as unknown as ChatList["items"][number]], next_before: null, next_before_id: null });
    await renderWithClient(<Chats />);
    await screen.findByTestId(`chat-row-${older.booking_id as string}`);
    expect(screen.queryByTestId("chat-row-closed")).toBeNull();
  });
});
