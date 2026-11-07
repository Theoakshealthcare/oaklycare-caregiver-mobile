import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import VoiceNoteReview from "../src/screens/chat/VoiceNoteReview";
import { CONSENT_VERSION } from "../src/voiceNotes/consentCopy";
import { FAKE_SUMMARY, FAKE_TRANSCRIPT, FakeVoiceNoteService, voiceNoteApiError } from "../src/voiceNotes/fakeService";
import { REQUEST_MESSAGES } from "../src/voiceNotes/messages";
import { setVoiceNoteServiceForTests } from "../src/voiceNotes/service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";

const mockGoBack = jest.fn();
const mockNav = { navigation: { navigate: jest.fn(), goBack: mockGoBack } };
jest.mock("../src/hooks/use-navigation", () => ({ __esModule: true, default: () => mockNav }));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/config/voiceNotes", () => ({ voiceNotesMode: () => "fake" }));
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ delete: jest.fn() })) }));

let service: FakeVoiceNoteService;

/** A note the fake has already transcribed (processingMs 0: ready at the first read). */
async function readyNote(script: ConstructorParameters<typeof FakeVoiceNoteService>[0] = {}) {
  service = new FakeVoiceNoteService({ processingMs: 0, ...script });
  setVoiceNoteServiceForTests(service);
  const note = await service.create("b1", { consentConfirmed: true, consentVersion: CONSENT_VERSION, language: "en", durationSeconds: 20, clientRequestId: `r-${Math.random()}` });
  await service.sendAudio(note.id, { uri: "file:///cache/a.m4a", mime: "audio/mp4" });
  return note;
}
const render = (noteId: string) => renderWithClient(<VoiceNoteReview {...routeProps<React.ComponentProps<typeof VoiceNoteReview>>({ bookingId: "b1", noteId })} />);
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const alertButton = (label: string) => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as Array<{ text: string; onPress?: () => void }>;
  return buttons.find((b) => b.text === label);
};

beforeEach(() => {
  mockGoBack.mockReset();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(() => {
  setVoiceNoteServiceForTests(null);
  jest.restoreAllMocks();
});

describe("Voice note review screen", () => {
  it("shows the AI draft with a warning to check it, the transcript and the summary in editable fields", async () => {
    const note = await readyNote();
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-transcript")).toBeTruthy());
    expect(screen.getByTestId("review-draft-notice")).toHaveTextContent(/AI draft/);
    expect(screen.getByTestId("review-transcript").props.value).toBe(FAKE_TRANSCRIPT);
    expect(screen.getByTestId("review-summary").props.value).toBe(FAKE_SUMMARY);
  });

  it("Save sends the edited text (trimmed), then goes back", async () => {
    const note = await readyNote();
    const saveSpy = jest.spyOn(service, "save");
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-transcript")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("review-transcript"), "  Blood pressure was 130 over 85.  ");
    await fireEvent.changeText(screen.getByTestId("review-summary"), "BP 130/85.");
    await press("review-save");
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(saveSpy).toHaveBeenCalledWith(note.id, { transcript: "Blood pressure was 130 over 85.", summary: "BP 130/85." });
    expect((await service.get(note.id)).edited).toBe(true);
  });

  it("the summary may be left empty", async () => {
    const note = await readyNote();
    const saveSpy = jest.spyOn(service, "save");
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-transcript")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("review-summary"), "");
    await press("review-save");
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(saveSpy).toHaveBeenCalledWith(note.id, { transcript: FAKE_TRANSCRIPT, summary: "" });
  });

  it("the transcript may not be left empty: nothing is sent", async () => {
    const note = await readyNote();
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-transcript")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("review-transcript"), "   ");
    await press("review-save");
    expect(service.calls.some((c) => c.method === "save")).toBe(false);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("Discard asks first, then deletes the note on the server and goes back", async () => {
    const note = await readyNote();
    const discardSpy = jest.spyOn(service, "discard");
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-discard")).toBeTruthy());
    await press("review-discard");
    expect(Alert.alert).toHaveBeenCalledWith("Discard this note?", expect.any(String), expect.any(Array));
    expect(discardSpy).not.toHaveBeenCalled(); // not before the caregiver confirms
    await act(async () => {
      alertButton("Discard")?.onPress?.();
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(discardSpy).toHaveBeenCalledWith(note.id);
    await expect(service.get(note.id)).rejects.toMatchObject({ status: 404 }); // gone server-side
  });

  it("Keep it leaves the note alone", async () => {
    const note = await readyNote();
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-discard")).toBeTruthy());
    await press("review-discard");
    expect(alertButton("Keep it")?.onPress).toBeUndefined();
    expect(service.calls.some((c) => c.method === "discard")).toBe(false);
  });

  it("when the summary step failed it says so and the caregiver can write one", async () => {
    const note = await readyNote({ script: [{ kind: "success", summary: null }] });
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-no-summary")).toBeTruthy());
    expect(screen.getByTestId("review-summary").props.value).toBe("");
    await fireEvent.changeText(screen.getByTestId("review-summary"), "Hand-written summary.");
    await press("review-save");
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect((await service.get(note.id)).summary).toBe("Hand-written summary.");
  });

  it("a failed save keeps the text and says why from detail.code", async () => {
    const note = await readyNote();
    jest.spyOn(service, "save").mockRejectedValueOnce(voiceNoteApiError(409, "already_saved"));
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-transcript")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("review-transcript"), "My careful edit.");
    await press("review-save");
    await waitFor(() => expect(screen.getByTestId("review-save-error")).toHaveTextContent(REQUEST_MESSAGES.already_saved));
    expect(screen.getByTestId("review-transcript").props.value).toBe("My careful edit.");
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("a saved note opens read-only with the final text and no Save or Discard", async () => {
    const note = await readyNote();
    await service.save(note.id, { transcript: "The final text.", summary: "The final summary." });
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-saved-transcript")).toHaveTextContent("The final text."));
    expect(screen.getByTestId("review-saved-summary")).toHaveTextContent("The final summary.");
    expect(screen.getByTestId("review-saved-banner")).toHaveTextContent(/edited by you/);
    expect(screen.queryByTestId("review-save")).toBeNull();
    expect(screen.queryByTestId("review-discard")).toBeNull();
  });

  it("a note still being transcribed is not editable", async () => {
    service = new FakeVoiceNoteService({ processingMs: 60_000 });
    setVoiceNoteServiceForTests(service);
    const note = await service.create("b1", { consentConfirmed: true, consentVersion: CONSENT_VERSION, language: "en", durationSeconds: 20, clientRequestId: "slow" });
    await service.sendAudio(note.id, { uri: "file:///cache/a.m4a", mime: "audio/mp4" });
    await render(note.id);
    await waitFor(() => expect(screen.getByTestId("review-not-ready")).toBeTruthy());
    expect(screen.queryByTestId("review-save")).toBeNull();
  });

  it("a note that is gone says so with the not_found sentence", async () => {
    service = new FakeVoiceNoteService();
    setVoiceNoteServiceForTests(service);
    await render("missing-note");
    await waitFor(() => expect(screen.getByTestId("review-error")).toHaveTextContent(REQUEST_MESSAGES.not_found));
  });
});
