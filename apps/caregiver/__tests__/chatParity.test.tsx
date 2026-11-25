import { fireEvent, screen } from "@testing-library/react-native";
import React from "react";

import { QUICK_REPLIES, bookingContext, withStamps } from "../src/components/chat/chatModel";
import ChatScreen from "../src/screens/chat/ChatScreen";
import type { Booking, ChatMessage } from "../src/services/booking.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
const mockPopTo = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, popTo: mockPopTo, goBack: jest.fn() } }),
}));

let mockMessages: Partial<ChatMessage>[] = [];
let mockBooking: Partial<Booking> | undefined;
const mockSend = jest.fn();
jest.mock("../src/hooks/queries", () => ({
  useMe: () => ({ data: { id: "me" } }),
  useChatMessages: () => ({ data: mockMessages }),
  useBooking: () => ({ data: mockBooking }),
  useSendChatMessage: () => ({ mutate: (...args: unknown[]) => mockSend(...args), isPending: false }),
}));

let mockMode: "off" | "fake" | "live" = "off";
jest.mock("../src/config/voiceNotes", () => ({ voiceNotesMode: () => mockMode }));

const msg = (id: string, sender: string, text: string, at: string): Partial<ChatMessage> => ({ id, sender_id: sender, message: text, created_at: at });
const BOOKING = {
  service_type: "nurse",
  assistance_type: "Wound Dressing",
  scheduled_date: "2026-11-25T10:00:00Z",
  scheduled_end_date: "2026-11-25T11:30:00Z",
  patient_address: "12 Placeholder Street",
  patient_city: "Lagos",
  patient_state: "Lagos",
  patient_details: { full_name: "Placeholder Patient", profile_image_url: null },
} as unknown as Booking;

const props = () => routeProps<React.ComponentProps<typeof ChatScreen>>({ bookingId: "b1", patientName: "Placeholder Patient" });

beforeEach(() => {
  mockMessages = [];
  mockBooking = undefined;
  mockMode = "off";
  mockNavigate.mockClear();
  mockPopTo.mockClear();
  mockSend.mockClear();
});

describe("chat header", () => {
  it("shows the patient's photo from the Chats list, and the letter when there is none", async () => {
    const withPhoto = routeProps<React.ComponentProps<typeof ChatScreen>>({ bookingId: "b1", patientName: "Placeholder Patient", patientPhotoUrl: "https://img.example/p.jpg" });
    await renderWithClient(<ChatScreen {...withPhoto} />);
    expect(screen.getByTestId("patient-avatar-photo")).toBeTruthy();
    expect(screen.queryByTestId("chat-avatar-initial")).toBeNull();
  });

  it("shows the name and initial, never a made-up presence or the old refresh line", async () => {
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByTestId("chat-name")).toHaveTextContent("Placeholder Patient");
    expect(screen.getByTestId("chat-avatar-initial")).toHaveTextContent("P");
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.queryByText(/refresh every few seconds/)).toBeNull();
  });

  it("has no mic (header or composer) while voice notes are off, and opens the AI Notetaker from both when on", async () => {
    const off = await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.queryByTestId("chat-notetaker")).toBeNull();
    expect(screen.queryByTestId("chat-composer-mic")).toBeNull();
    await off.unmount();
    mockMode = "live";
    await renderWithClient(<ChatScreen {...props()} />);
    await fireEvent.press(screen.getByTestId("chat-notetaker"));
    expect(mockNavigate).toHaveBeenCalledWith("AINoteTaker", { bookingId: "b1" });
    mockNavigate.mockClear();
    await fireEvent.press(screen.getByTestId("chat-composer-mic"));
    expect(mockNavigate).toHaveBeenCalledWith("AINoteTaker", { bookingId: "b1" });
  });
});

describe("booking card and stamps", () => {
  it("draws the booking card with the care needed, service chip, address and a way back to the booking", async () => {
    mockBooking = BOOKING;
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getByTestId("chat-booking-title")).toHaveTextContent("Wound Dressing");
    expect(screen.getByTestId("chat-booking-chip")).toHaveTextContent("Nurse visit");
    expect(screen.getByTestId("chat-booking-address")).toHaveTextContent("12 Placeholder Street");
    await fireEvent.press(screen.getByText("View Booking Details"));
    expect(mockPopTo).toHaveBeenCalledWith("BookingDetails", { bookingId: "b1" });
  });

  it("shows no card until the booking has loaded", async () => {
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.queryByTestId("chat-booking-card")).toBeNull();
  });

  it("falls back to the area when the server withholds the address", () => {
    const context = bookingContext({ ...BOOKING, patient_address: null } as Booking);
    expect(context.address).toBe("Lagos, Lagos");
  });

  it("puts a stamp above the first message and after a gap, not between messages sent close together", async () => {
    mockMessages = [
      msg("1", "them", "Hello", "2026-11-22T08:00:00Z"),
      msg("2", "me", "Hi", "2026-11-22T08:05:00Z"),
      msg("3", "them", "Later", "2026-11-22T10:30:00Z"),
    ];
    await renderWithClient(<ChatScreen {...props()} />);
    expect(screen.getAllByTestId("chat-stamp")).toHaveLength(2);
    expect(screen.getByText("Hi")).toBeTruthy();
    expect(screen.getAllByTestId("chat-bubble-mine")).toHaveLength(1);
    expect(screen.getAllByTestId("chat-bubble-theirs")).toHaveLength(2);
  });

  it("withStamps adds no stamp for an unreadable time", () => {
    expect(withStamps([msg("1", "me", "x", "not a date") as ChatMessage])).toHaveLength(1);
  });
});

describe("quick replies and composer", () => {
  it("a chip sends its words as a plain message", async () => {
    await renderWithClient(<ChatScreen {...props()} />);
    for (const reply of QUICK_REPLIES) expect(screen.getByText(reply)).toBeTruthy();
    await fireEvent.press(screen.getByText("I've arrived"));
    expect(mockSend).toHaveBeenCalledWith("I've arrived", expect.any(Object));
  });

  it("typed text is trimmed and sent from the paper-plane button", async () => {
    await renderWithClient(<ChatScreen {...props()} />);
    await fireEvent.changeText(screen.getByPlaceholderText("Type a message..."), "  See you soon ");
    await fireEvent.press(screen.getByTestId("chat-send"));
    expect(mockSend).toHaveBeenCalledWith("See you soon", expect.any(Object));
  });
});
