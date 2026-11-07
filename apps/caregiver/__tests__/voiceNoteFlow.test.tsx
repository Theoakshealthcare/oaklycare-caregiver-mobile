import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { Alert } from "react-native";

import AINoteTaker from "../src/screens/chat/AINoteTaker";
import { ApiError, NETWORK_MESSAGE } from "../src/api/errors";
import { CONSENT_VERSION } from "../src/voiceNotes/consentCopy";
import { FAKE_SUMMARY, FAKE_TRANSCRIPT, FakeVoiceNoteService } from "../src/voiceNotes/fakeService";
import { FAILURE_MESSAGES, REQUEST_MESSAGES } from "../src/voiceNotes/messages";
import { forgetAllLocalRecordings } from "../src/voiceNotes/localAudio";
import { setVoiceNoteServiceForTests } from "../src/voiceNotes/service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";

const mockNavigate = jest.fn();
const mockNav = { navigation: { navigate: mockNavigate, goBack: jest.fn() } };
jest.mock("../src/hooks/use-navigation", () => ({ __esModule: true, default: () => mockNav }));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

let mockMode: "off" | "fake" = "fake";
jest.mock("../src/config/voiceNotes", () => ({ voiceNotesMode: () => mockMode }));

const mockDeleteFile = jest.fn();
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ delete: () => mockDeleteFile(uri) })),
}));

const mockCreateNote = jest.fn();
jest.mock("../src/hooks/queries", () => ({
  useNotes: () => ({ data: [] }),
  useCreateNote: () => ({ mutate: mockCreateNote, isPending: false }),
}));

const RECORDING_URI = "file:///cache/visit-note.m4a";
let mockUri: string | null = RECORDING_URI;
const mockPermission = jest.fn();
jest.mock("expo-audio", () => ({
  useAudioRecorder: () => ({
    prepareToRecordAsync: async () => {},
    record: () => {},
    stop: async () => {},
    get uri() {
      return mockUri;
    },
  }),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: () => mockPermission(),
  setAudioModeAsync: async () => {},
}));

let bookingCounter = 0;
let bookingId = "";
let service: FakeVoiceNoteService;

const render = () => renderWithClient(<AINoteTaker {...routeProps<React.ComponentProps<typeof AINoteTaker>>({ bookingId })} />);
/** What was created or uploaded; reading the visit's notes is allowed (it creates nothing). */
const sent = () => service.calls.filter((c) => c.method === "create" || c.method === "sendAudio");
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
/** Move the clock (and every timer, including the poll) forward. Date is faked with the timers. */
const advance = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};
async function consentAndRecord(seconds: number) {
  await waitFor(() => expect(screen.getByTestId("consent-checkbox")).toBeTruthy());
  await press("consent-checkbox");
  await press("mic-button");
  await waitFor(() => expect(screen.getByTestId("recording-indicator")).toBeTruthy());
  await advance(seconds * 1000);
  await press("mic-button");
}

beforeEach(() => {
  jest.useFakeTimers();
  bookingCounter += 1;
  bookingId = `visit-${bookingCounter}`; // the consent tick is remembered per booking, so each test has its own
  mockMode = "fake";
  mockUri = RECORDING_URI;
  mockNavigate.mockReset();
  mockCreateNote.mockReset();
  mockDeleteFile.mockReset();
  mockPermission.mockReset().mockResolvedValue({ granted: true });
  service = new FakeVoiceNoteService({ processingMs: 5000 });
  setVoiceNoteServiceForTests(service);
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  setVoiceNoteServiceForTests(null);
  forgetAllLocalRecordings();
  jest.restoreAllMocks();
});

describe("voice notes off (the default)", () => {
  it("shows no consent step, no language choice and no upload, and keeps the old message", async () => {
    mockMode = "off";
    await render();
    expect(screen.queryByTestId("consent-card")).toBeNull();
    expect(screen.queryByTestId("language-en")).toBeNull();
    expect(screen.getByText(/Voice recordings are not transcribed yet/)).toBeTruthy();
    expect(service.calls).toEqual([]); // off: not even a read
  });
});

describe("consent step", () => {
  it("shows the consent line (naming the external AI service) and keeps the mic off until the box is ticked", async () => {
    await render();
    await waitFor(() => expect(screen.getByTestId("consent-card")).toBeTruthy());
    expect(screen.getByText("Before you record")).toBeTruthy();
    expect(screen.getByTestId("consent-line")).toHaveTextContent(/external AI service \(Google Gemini\)/);
    expect(screen.getByTestId("mic-button").props.accessibilityState.disabled).toBe(true);
    await press("mic-button");
    expect(mockPermission).not.toHaveBeenCalled();
    expect(sent()).toEqual([]); // nothing is created or uploaded without consent
    await press("consent-checkbox");
    expect(screen.getByTestId("mic-button").props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByTestId("consent-card")).toBeNull();
    expect(screen.getByTestId("consent-given")).toBeTruthy();
  });

  it("remembers the tick for this visit only, and Undo takes it back", async () => {
    const first = await render();
    await waitFor(() => expect(screen.getByTestId("consent-checkbox")).toBeTruthy());
    await press("consent-checkbox");
    await first.unmount();
    await render();
    await waitFor(() => expect(screen.getByTestId("consent-given")).toBeTruthy());
    expect(screen.queryByTestId("consent-card")).toBeNull();
    await press("consent-undo");
    expect(screen.getByTestId("consent-card")).toBeTruthy();
    expect(await SecureStore.getItemAsync(`oakly.voice-consent.${bookingId}`)).toBeNull();
  });

  it("another visit starts unticked, and a tick given to an older wording does not count", async () => {
    await SecureStore.setItemAsync(`oakly.voice-consent.${bookingId}`, "2020-01-v0");
    await render();
    await waitFor(() => expect(screen.getByTestId("consent-card")).toBeTruthy());
    expect(await SecureStore.getItemAsync("oakly.voice-consent.some-other-visit")).toBeNull();
  });
});

describe("recording, upload and transcribing", () => {
  it("sends the recording with the consent and chosen language, shows transcribing, then opens the review screen", async () => {
    const createSpy = jest.spyOn(service, "create");
    await render();
    await waitFor(() => expect(screen.getByTestId("language-pcm")).toBeTruthy());
    await press("language-pcm");
    await consentAndRecord(4);
    await waitFor(() => expect(screen.getByTestId("transcribing-card")).toBeTruthy());
    expect(screen.getByText("Turning your recording into text...")).toBeTruthy();
    expect(createSpy).toHaveBeenCalledWith(bookingId, expect.objectContaining({ consentConfirmed: true, consentVersion: CONSENT_VERSION, language: "pcm", durationSeconds: 4 }));
    expect(service.calls.map((c) => c.method)).toEqual(expect.arrayContaining(["create", "sendAudio"]));
    expect(mockDeleteFile).not.toHaveBeenCalled(); // the phone keeps the file until the text is ready
    await advance(8000);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("VoiceNoteReview", { bookingId, noteId: expect.any(String) }));
    expect(mockDeleteFile).toHaveBeenCalledWith(RECORDING_URI); // gone as soon as the note is ready
  });

  it("a recording shorter than two seconds is not sent", async () => {
    await render();
    await consentAndRecord(1);
    expect(Alert.alert).toHaveBeenCalledWith("Recording too short", expect.any(String));
    expect(sent()).toEqual([]);
    expect(mockDeleteFile).toHaveBeenCalledWith(RECORDING_URI);
  });

  it("stops by itself at ten minutes and sends what it has", async () => {
    const createSpy = jest.spyOn(service, "create");
    await render();
    await waitFor(() => expect(screen.getByTestId("consent-checkbox")).toBeTruthy());
    await press("consent-checkbox");
    await press("mic-button");
    await waitFor(() => expect(screen.getByTestId("recording-indicator")).toBeTruthy());
    await advance(601_000);
    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy.mock.calls[0][1].durationSeconds).toBe(600);
  });

  it("says why when the upload cannot start, and Try again reuses the same request id", async () => {
    const createSpy = jest.spyOn(service, "create").mockRejectedValueOnce(new ApiError(0, null, NETWORK_MESSAGE));
    await render();
    await consentAndRecord(3);
    await waitFor(() => expect(screen.getByTestId("pending-message")).toHaveTextContent(NETWORK_MESSAGE));
    await press("pending-retry");
    await waitFor(() => expect(screen.getByTestId("transcribing-card")).toBeTruthy());
    expect(createSpy.mock.calls[1][1].clientRequestId).toBe(createSpy.mock.calls[0][1].clientRequestId);
    expect(screen.queryByTestId("pending-card")).toBeNull();
  });

  it("explains a refused upload from detail.code", async () => {
    jest.spyOn(service, "create").mockRejectedValueOnce(
      new ApiError(409, { detail: { code: "visit_not_active", message: "x" } }, "x"),
    );
    await render();
    await consentAndRecord(3);
    await waitFor(() => expect(screen.getByTestId("pending-message")).toHaveTextContent(REQUEST_MESSAGES.visit_not_active));
  });

  it("Discard on an unsent recording deletes the local file and clears the card", async () => {
    jest.spyOn(service, "create").mockRejectedValueOnce(new ApiError(0, null, NETWORK_MESSAGE));
    await render();
    await consentAndRecord(3);
    await waitFor(() => expect(screen.getByTestId("pending-discard")).toBeTruthy());
    await press("pending-discard");
    expect(screen.queryByTestId("pending-card")).toBeNull();
    expect(mockDeleteFile).toHaveBeenCalledWith(RECORDING_URI);
  });

  it("after three minutes it says it is taking longer and offers Check again and Discard", async () => {
    service = new FakeVoiceNoteService({ processingMs: 60 * 60_000 });
    setVoiceNoteServiceForTests(service);
    await render();
    await consentAndRecord(3);
    await waitFor(() => expect(screen.getByTestId("transcribing-card")).toBeTruthy());
    expect(screen.queryByTestId("transcribing-check")).toBeNull();
    await advance(3 * 60_000 + 1000);
    expect(screen.getByTestId("transcribing-hint")).toHaveTextContent(/taking longer than usual/);
    expect(screen.getByTestId("transcribing-check")).toBeTruthy();
    await press("transcribing-discard");
    await waitFor(() => expect(service.calls.some((c) => c.method === "discard")).toBe(true));
  });
});

describe("a failed transcription", () => {
  it("a retryable failure shows its sentence and Try again, which runs it again", async () => {
    service = new FakeVoiceNoteService({ processingMs: 1000, script: [{ kind: "fail", code: "provider_unavailable" }] });
    setVoiceNoteServiceForTests(service);
    await render();
    await consentAndRecord(3);
    await advance(6000);
    await waitFor(() => expect(screen.getByTestId("failed-message")).toHaveTextContent(FAILURE_MESSAGES.provider_unavailable));
    await press("failed-retry");
    expect(service.calls.map((c) => c.method)).toContain("retry");
    await advance(6000);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("VoiceNoteReview", expect.anything()));
  });

  it.each([
    ["no_speech_detected"],
    ["audio_unsupported"],
    ["provider_blocked"],
  ] as const)("%s is not retryable: no Try again, a way to type instead, and Discard deletes it on the server", async (code) => {
    service = new FakeVoiceNoteService({ processingMs: 1000, script: [{ kind: "fail", code }] });
    setVoiceNoteServiceForTests(service);
    await render();
    await consentAndRecord(3);
    await advance(6000);
    await waitFor(() => expect(screen.getByTestId("failed-message")).toHaveTextContent(FAILURE_MESSAGES[code]));
    expect(screen.queryByTestId("failed-retry")).toBeNull();
    await press("failed-discard");
    await waitFor(() => expect(service.calls.some((c) => c.method === "discard")).toBe(true));
    await waitFor(() => expect(screen.queryByTestId("failed-card")).toBeNull());
  });

  it("when the server no longer holds the audio, Try again sends the phone's copy and the file is still there", async () => {
    service = new FakeVoiceNoteService({ processingMs: 1000, script: [{ kind: "fail", code: "transcription_failed" }], audioExpiresAfterFailure: true });
    setVoiceNoteServiceForTests(service);
    await render();
    await consentAndRecord(3);
    await advance(6000);
    await waitFor(() => expect(screen.getByTestId("failed-retry")).toBeTruthy());
    expect(mockDeleteFile).not.toHaveBeenCalled();
    await press("failed-retry");
    await waitFor(() => expect(service.calls.filter((c) => c.method === "sendAudio")).toHaveLength(2));
  });
});

describe("coming back to a visit", () => {
  async function seed(outcome: ConstructorParameters<typeof FakeVoiceNoteService>[0] = {}) {
    service = new FakeVoiceNoteService({ processingMs: 0, ...outcome });
    setVoiceNoteServiceForTests(service);
    const note = await service.create(bookingId, { consentConfirmed: true, consentVersion: CONSENT_VERSION, language: "en", durationSeconds: 30, clientRequestId: "seed" });
    await service.sendAudio(note.id, { uri: RECORDING_URI, mime: "audio/mp4" });
    return note;
  }

  it("a ready draft waits as 'ready to check' and opens the review screen", async () => {
    const note = await seed();
    await render();
    await waitFor(() => expect(screen.getByTestId("ready-card")).toBeTruthy());
    await press("ready-review");
    expect(mockNavigate).toHaveBeenCalledWith("VoiceNoteReview", { bookingId, noteId: note.id });
  });

  it("a saved voice note shows the caregiver's final text under Voice notes", async () => {
    const note = await seed();
    await service.save(note.id, { transcript: "Final words the caregiver kept.", summary: "Final summary." });
    await render();
    await waitFor(() => expect(screen.getByTestId(`saved-note-${note.id}`)).toBeTruthy());
    expect(screen.getByTestId("saved-transcript")).toHaveTextContent("Final words the caregiver kept.");
    expect(screen.getByTestId("saved-summary")).toHaveTextContent("Final summary.");
    expect(screen.getByText(/edited by you/)).toBeTruthy();
    expect(screen.queryByText(FAKE_TRANSCRIPT)).toBeNull(); // the AI draft is not shown once the final text is saved
    expect(screen.queryByText(FAKE_SUMMARY)).toBeNull();
  });
});

describe("the typed note path", () => {
  it("still saves a typed note with a title in fake mode", async () => {
    await render();
    // Let the consent lookup finish first: a state update landing in the middle of an act() scope is what warns.
    await waitFor(() => expect(screen.getByTestId("consent-card")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("Note title..."), "Evening check");
    await fireEvent.changeText(screen.getByPlaceholderText("Write your observations here..."), "Ate well, no pain.");
    await fireEvent.press(screen.getByText("Save Note"));
    expect(mockCreateNote).toHaveBeenCalledWith({ title: "Evening check", content: "Ate well, no pain." }, expect.any(Object));
    expect(sent()).toEqual([]); // the typed path never touches the voice note service
  });
});
