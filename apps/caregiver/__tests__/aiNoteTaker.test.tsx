import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import AINoteTaker from "../src/screens/chat/AINoteTaker";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";

jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

let mockNotes: unknown[] = [];
jest.mock("../src/hooks/queries", () => ({
  useBooking: () => ({ data: undefined }),
  useNotes: () => ({ data: mockNotes }),
  useCreateNote: () => ({ mutate: jest.fn(), isPending: false }),
}));

const mockPermission = jest.fn();
const mockRecord = jest.fn();
jest.mock("expo-audio", () => ({
  useAudioRecorder: () => ({ prepareToRecordAsync: async () => {}, record: () => mockRecord(), stop: async () => {}, uri: null }),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: () => mockPermission(),
  setAudioModeAsync: async () => {},
}));

const render = () => renderWithClient(<AINoteTaker {...routeProps<React.ComponentProps<typeof AINoteTaker>>({ bookingId: "b1" })} />);

describe("AI Note Taker (DP1-17)", () => {
  beforeEach(() => {
    mockNotes = [];
    mockPermission.mockReset().mockResolvedValue({ granted: true });
    mockRecord.mockReset();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("voice off: the title has no stray comma and there is no orb or Voice to text pill", async () => {
    await render();
    expect(screen.getByText("AI Notetaker")).toBeTruthy();
    expect(screen.queryByTestId("ai-orb")).toBeNull();
    expect(screen.queryByText("Voice to text")).toBeNull();
  });

  it("does not ask for the microphone when the screen opens", async () => {
    await render();
    expect(mockPermission).not.toHaveBeenCalled();
  });

  it("asks when the mic is tapped, then shows a recording indicator with a timer", async () => {
    jest.useFakeTimers();
    await render();
    await act(async () => {
      fireEvent.press(screen.getByTestId("mic-button"));
    });
    expect(mockPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("recording-indicator")).toBeTruthy());
    expect(screen.getByTestId("recording-timer")).toHaveTextContent("Recording 00:00");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId("recording-timer")).toHaveTextContent("Recording 00:03");
    jest.useRealTimers();
  });

  it("a refused microphone says so and never starts recording", async () => {
    mockPermission.mockResolvedValue({ granted: false });
    await render();
    await act(async () => {
      fireEvent.press(screen.getByTestId("mic-button"));
    });
    expect(mockRecord).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Microphone is off", expect.stringContaining("type your note"), expect.any(Array));
    expect(screen.queryByTestId("recording-indicator")).toBeNull();
  });

  it("the subtitle no longer promises AI analysis of recordings", async () => {
    await render();
    expect(screen.queryByText(/Record or write notes with AI analysis/)).toBeNull();
    expect(screen.getByText(/Voice recordings are not transcribed yet/)).toBeTruthy();
  });

  it("explains an empty Previous Notes list, and hides the text once there is a note", async () => {
    const first = await render();
    expect(screen.getByTestId("notes-empty")).toBeTruthy();
    await first.unmount();
    mockNotes = [{ id: "n1", booking_id: "b1", caregiver_id: "c1", title: "Note 1", content: "Text", created_at: "2026-11-07T10:56:00" }];
    await render();
    expect(screen.queryByTestId("notes-empty")).toBeNull();
    expect(screen.getByText("Note 1")).toBeTruthy();
  });
});
