import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { session } from "../src/auth";
import Chats from "../src/screens/chats/Chats";
import { chatsService, type ChatList, type ChatSummary } from "../src/services/chats.service";
import { renderWithClient } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: jest.fn(),
}));

const NOW = new Date();
const row = (id: string, name: string, text: string | null, minutesAgo = 5): ChatSummary =>
  ({
    booking_id: id,
    patient_name: name,
    service_type: "nurse",
    status: "accepted",
    scheduled_date: "2026-11-25T10:00:00",
    last_message: text === null ? null : { text, sent_at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString().replace("Z", ""), from_me: false },
  }) as ChatSummary;
const page = (items: ChatSummary[], next: { before: string; before_id: string } | null = null): ChatList => ({
  items,
  next_before: next?.before ?? null,
  next_before_id: next?.before_id ?? null,
});

const ADA = row("b1", "Ada Okafor", "Are you close?");
const BEN = row("b2", "Ben Okoro", "See you at ten");
const CARA = row("b3", "Cara Eze", null);

beforeEach(async () => {
  mockNavigate.mockClear();
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await session.signOut();
});

describe("Chats tab", () => {
  it("draws the header, the avatar row and a row per conversation with last message and time", async () => {
    jest.spyOn(chatsService, "listChats").mockResolvedValue(page([ADA, BEN, CARA]));
    await renderWithClient(<Chats />);
    expect(await screen.findByTestId("chat-row-b1")).toBeTruthy();
    expect(screen.getByText("Chats")).toBeTruthy();
    expect(screen.getByTestId("chats-search")).toBeTruthy();
    expect(screen.getByTestId("chats-avatar-row")).toBeTruthy();
    expect(screen.getByTestId("chats-avatar-b2")).toBeTruthy();
    expect(screen.getAllByTestId("chat-row-name").map((n) => n.props.children)).toEqual(["Ada Okafor", "Ben Okoro", "Cara Eze"]);
    expect(screen.getAllByTestId("chat-row-preview").map((n) => n.props.children)).toEqual(["Are you close?", "See you at ten", "No messages yet"]);
    // A time for the two conversations with a message, none for the quiet one.
    expect(screen.getAllByTestId("chat-row-time")).toHaveLength(2);
  });

  it("has no filter button, no Oakly Admin row and no unread badge (nothing backs them)", async () => {
    jest.spyOn(chatsService, "listChats").mockResolvedValue(page([ADA]));
    await renderWithClient(<Chats />);
    await screen.findByTestId("chat-row-b1");
    expect(screen.queryByText("Oakly Admin")).toBeNull();
    expect(screen.queryByLabelText(/filter/i)).toBeNull();
    expect(screen.queryByTestId(/unread/)).toBeNull();
  });

  it("opens the existing chat for the booking when a row or an avatar is pressed", async () => {
    jest.spyOn(chatsService, "listChats").mockResolvedValue(page([ADA, BEN]));
    await renderWithClient(<Chats />);
    await fireEvent.press(await screen.findByTestId("chat-row-b2"));
    expect(mockNavigate).toHaveBeenCalledWith("ChatScreen", { bookingId: "b2", patientName: "Ben Okoro" });
    mockNavigate.mockClear();
    await fireEvent.press(screen.getByTestId("chats-avatar-b1"));
    expect(mockNavigate).toHaveBeenCalledWith("ChatScreen", { bookingId: "b1", patientName: "Ada Okafor" });
  });

  it("search filters the loaded list by patient name and hides the avatar row; clearing restores it", async () => {
    jest.spyOn(chatsService, "listChats").mockResolvedValue(page([ADA, BEN, CARA]));
    await renderWithClient(<Chats />);
    await screen.findByTestId("chat-row-b1");
    await fireEvent.changeText(screen.getByTestId("chats-search"), "oko");
    expect(screen.queryByTestId("chat-row-b1")).toBeNull();
    expect(screen.getByTestId("chat-row-b2")).toBeTruthy();
    expect(screen.queryByTestId("chats-avatar-row")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("chats-search"), "nobody");
    expect(screen.getByText("No chats found")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("chats-search-clear"));
    expect(screen.getByTestId("chat-row-b1")).toBeTruthy();
    expect(screen.getByTestId("chats-avatar-row")).toBeTruthy();
  });

  it("shows an empty state when there are no conversations", async () => {
    jest.spyOn(chatsService, "listChats").mockResolvedValue(page([]));
    await renderWithClient(<Chats />);
    expect(await screen.findByText("No chats yet")).toBeTruthy();
    expect(screen.queryByTestId("chats-avatar-row")).toBeNull();
  });

  it("shows a loading state, then an error with a working Try again", async () => {
    const spy = jest.spyOn(chatsService, "listChats").mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([ADA]));
    await renderWithClient(<Chats />);
    expect(screen.getByTestId("chats-loading")).toBeTruthy();
    expect(await screen.findByTestId("chats-error")).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("chat-row-b1")).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("loads the next page with the cursor the server gave, and only while a next page exists", async () => {
    const spy = jest
      .spyOn(chatsService, "listChats")
      .mockResolvedValueOnce(page([ADA], { before: "2026-11-24T10:00:00", before_id: "b1" }))
      .mockResolvedValueOnce(page([BEN]));
    await renderWithClient(<Chats />);
    await fireEvent.press(await screen.findByText("Load earlier chats"));
    expect(await screen.findByTestId("chat-row-b2")).toBeTruthy();
    expect(spy).toHaveBeenLastCalledWith({ before: "2026-11-24T10:00:00", before_id: "b1" });
    await waitFor(() => expect(screen.queryByText("Load earlier chats")).toBeNull());
  });

  it("does not fetch while its tab is not showing", async () => {
    const spy = jest.spyOn(chatsService, "listChats").mockResolvedValue(page([ADA]));
    await renderWithClient(<Chats active={false} />);
    expect(spy).not.toHaveBeenCalled();
  });
});
