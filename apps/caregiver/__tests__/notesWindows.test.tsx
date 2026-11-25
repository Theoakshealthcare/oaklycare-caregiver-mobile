import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError } from "../src/api/errors";
import AINoteTaker, { NOTES_CLOSED, NOTES_GONE, NOTES_NOT_SAVED } from "../src/screens/chat/AINoteTaker";
import type { Booking, BookingNote } from "../src/services/booking.service";
import { formatUntil } from "../src/utils/dates";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import { retimed, windowCapture } from "../test-utils/windowCaptures";

jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

let mockNotes: Partial<BookingNote>[] = [];
let mockReadError: unknown = null;
let mockBooking: Partial<Booking> | undefined;
const mockCreate = jest.fn();
jest.mock("../src/hooks/queries", () => ({
  useNotes: () => ({ data: mockReadError ? undefined : mockNotes, error: mockReadError }),
  useBooking: () => ({ data: mockBooking }),
  useCreateNote: () => ({ mutate: (...args: unknown[]) => mockCreate(...args), isPending: false }),
}));
jest.mock("expo-audio", () => ({
  useAudioRecorder: () => ({ prepareToRecordAsync: async () => {}, record: () => {}, stop: async () => {}, uri: null }),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
  setAudioModeAsync: async () => {},
}));

// The rows of the backend's capture `009` (a caregiver's bookings): in progress, completed 1 h ago, completed 2 h ago, completed 30 h ago.
const rows = windowCapture("009-c-bookings-notes-window").body as Record<string, unknown>[];
const [IN_PROGRESS, COMPLETED_1H, COMPLETED_2H, COMPLETED_30H] = rows.map(retimed);
const NOT_ACTIVE = windowCapture("011-c-note-create-after-grace");
const NOT_FOUND = windowCapture("012-c-notes-read-after-24h");
const withBooking = (row: Record<string, unknown>) => {
  mockBooking = row as unknown as Partial<Booking>;
};
const render = () => renderWithClient(<AINoteTaker {...routeProps<React.ComponentProps<typeof AINoteTaker>>({ bookingId: "b1" })} />);
const fill = async () => {
  await fireEvent.changeText(screen.getByLabelText("Note title"), "Placeholder title");
  await fireEvent.changeText(screen.getByLabelText("Write your note here"), "Placeholder note");
};

let alert: jest.SpyInstance;
beforeEach(() => {
  mockNotes = [];
  mockReadError = null;
  mockBooking = undefined;
  mockCreate.mockReset();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("visit notes: the add window", () => {
  it("shows both entry forms and no banner while the visit is in progress", async () => {
    withBooking(IN_PROGRESS);
    await render();
    expect(screen.getByTestId("note-form")).toBeTruthy();
    expect(screen.getByTestId("note-save-bar")).toBeTruthy();
    expect(screen.getByTestId("mic-button")).toBeTruthy();
    expect(screen.queryByTestId("notes-window-banner")).toBeNull();
  });

  it("shows the forms when the booking carries none of the new fields (an older backend, or still loading)", async () => {
    await render();
    expect(screen.getByTestId("note-form")).toBeTruthy();
    expect(screen.queryByTestId("notes-window-banner")).toBeNull();
  });

  it("says when notes close once the visit is completed and the window is still open", async () => {
    withBooking(COMPLETED_1H);
    await render();
    expect(screen.getByTestId("notes-window-banner")).toHaveTextContent(`Visit complete. You can add notes until ${formatUntil(COMPLETED_1H.notes_closes_at as string)}.`);
    expect(screen.getByTestId("note-form")).toBeTruthy();
    expect(screen.getByTestId("note-save-bar")).toBeTruthy();
  });

  it("closes both entry forms, the mic and Save Note with a banner once notes_open is false (2 h after the visit)", async () => {
    mockNotes = [{ id: "n1", title: "Placeholder earlier note", content: "kept", created_at: "2026-11-25T07:00:00" }];
    withBooking(COMPLETED_2H);
    await render();
    expect(screen.getByTestId("notes-window-banner")).toHaveTextContent(NOTES_CLOSED);
    expect(NOTES_CLOSED).toBe("Notes for this visit are closed.");
    expect(screen.queryByTestId("note-form")).toBeNull();
    expect(screen.queryByTestId("note-save-bar")).toBeNull();
    expect(screen.queryByTestId("mic-button")).toBeNull();
    expect(screen.queryByTestId("voice-panel")).toBeNull();
    // the notes the caregiver already wrote can still be read (they are readable for 24 h)
    expect(screen.getByText("Placeholder earlier note")).toBeTruthy();
    expect(screen.queryByTestId("notes-gone")).toBeNull();
  });

  it("keeps the typed note on screen, says it was not saved, and stops offering Save when the save is refused (409 visit_not_active)", async () => {
    expect(NOT_ACTIVE.status).toBe(409);
    mockCreate.mockImplementation((_vars: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(new ApiError(NOT_ACTIVE.status, NOT_ACTIVE.body, "x")),
    );
    withBooking(COMPLETED_1H);
    await render();
    await fill();
    await fireEvent.press(screen.getByText("Save Note"));
    await waitFor(() => expect(screen.getByTestId("notes-window-banner")).toHaveTextContent(`${NOTES_CLOSED} ${NOTES_NOT_SAVED}`));
    expect(screen.getByLabelText("Note title").props.value).toBe("Placeholder title");
    expect(screen.getByLabelText("Write your note here").props.value).toBe("Placeholder note");
    expect(screen.getByLabelText("Note title").props.editable).toBe(false);
    expect(screen.queryByTestId("note-save-bar")).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("still alerts for any other failed save", async () => {
    mockCreate.mockImplementation((_vars: unknown, options: { onError: (e: unknown) => void }) => options.onError(new ApiError(500, { detail: "boom" }, "boom")));
    withBooking(COMPLETED_1H);
    await render();
    await fill();
    await fireEvent.press(screen.getByText("Save Note"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Error", expect.any(String)));
    expect(screen.queryByText(NOTES_CLOSED)).toBeNull();
    expect(screen.getByTestId("note-save-bar")).toBeTruthy();
  });
});

describe("visit notes: the read window", () => {
  it("says the notes are no longer available, with no crash, when reading them answers 404 not_found (24 h after the visit)", async () => {
    expect(NOT_FOUND.status).toBe(404);
    mockReadError = new ApiError(NOT_FOUND.status, NOT_FOUND.body, "x");
    withBooking(COMPLETED_30H);
    await render();
    expect(screen.getByTestId("notes-gone")).toHaveTextContent(NOTES_GONE);
    expect(NOTES_GONE).toBe("These notes are no longer available.");
    expect(screen.queryByTestId("note-form")).toBeNull();
    expect(screen.queryByTestId("note-save-bar")).toBeNull();
    expect(screen.getByTestId("notes-window-banner")).toHaveTextContent(NOTES_CLOSED);
  });

  it("does not draw notes cached past notes_readable_until, even before the 404 arrives", async () => {
    mockNotes = [{ id: "n1", title: "Placeholder cached note", content: "stale", created_at: "2026-11-24T05:00:00" }];
    withBooking(COMPLETED_30H);
    await render();
    expect(screen.queryByText("Placeholder cached note")).toBeNull();
    expect(screen.getByTestId("notes-gone")).toHaveTextContent(NOTES_GONE);
  });

  it("treats a different read failure as before, not as 'no longer available'", async () => {
    mockReadError = new ApiError(500, { detail: "boom" }, "boom");
    withBooking(COMPLETED_1H);
    await render();
    expect(screen.queryByTestId("notes-gone")).toBeNull();
    expect(screen.getByTestId("note-form")).toBeTruthy();
  });
});
