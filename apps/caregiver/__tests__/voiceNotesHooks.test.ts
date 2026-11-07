import { ApiError, NETWORK_MESSAGE } from "../src/api/errors";
import { retryVoiceNote, submitRecording } from "../src/hooks/useVoiceNotes";
import { voiceNoteApiError } from "../src/voiceNotes/fakeService";
import { forgetAllLocalRecordings, forgetLocalRecording, localRecordingFor, newRequestId, rememberLocalRecording } from "../src/voiceNotes/localAudio";
import type { VoiceNoteService } from "../src/voiceNotes/service";
import type { VoiceNote } from "../src/voiceNotes/types";

const mockDelete = jest.fn();
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation((uri: string) => ({ delete: () => mockDelete(uri) })) }));

const note = (over: Partial<VoiceNote> = {}): VoiceNote => ({
  id: "n1", booking_id: "b1", status: "awaiting_audio", language: "en", transcript: null, summary: null, summary_available: false,
  edited: false, error: null, duration_seconds: 10, consent_version: "2026-11-v1", consent_confirmed_at: "2026-11-07T10:00:00",
  created_at: "2026-11-07T10:00:00", ready_at: null, saved_at: null, expires_at: null, ...over,
});
const service = (over: Partial<VoiceNoteService> = {}): jest.Mocked<VoiceNoteService> =>
  ({ create: jest.fn(), sendAudio: jest.fn(), get: jest.fn(), listForVisit: jest.fn(), retry: jest.fn(), save: jest.fn(), discard: jest.fn(), ...over }) as jest.Mocked<VoiceNoteService>;
const job = { clientRequestId: "req-1", recording: { uri: "file:///cache/a.m4a", mime: "audio/mp4" }, durationSeconds: 12, language: "pcm" as const };

afterEach(() => forgetAllLocalRecordings());

describe("submitRecording", () => {
  it("creates the note with the consent, language and request id, then sends the audio", async () => {
    const s = service();
    s.create.mockResolvedValue(note());
    s.sendAudio.mockResolvedValue(note({ status: "processing" }));
    const result = await submitRecording(s, "b1", job);
    expect(s.create).toHaveBeenCalledWith("b1", { consentConfirmed: true, consentVersion: "2026-11-v1", language: "pcm", durationSeconds: 12, clientRequestId: "req-1" });
    expect(s.sendAudio).toHaveBeenCalledWith("n1", job.recording);
    expect(result.status).toBe("processing");
    expect(localRecordingFor("n1")).toBe(job.recording.uri); // kept for a retry until the note is ready
  });

  it("does not send the audio twice when create returns a note an earlier attempt already sent", async () => {
    const s = service();
    s.create.mockResolvedValue(note({ status: "processing" }));
    expect((await submitRecording(s, "b1", job)).status).toBe("processing");
    expect(s.sendAudio).not.toHaveBeenCalled();
  });

  it("treats already_processing as success (the first send got through) and reads the note", async () => {
    const s = service();
    s.create.mockResolvedValue(note());
    s.sendAudio.mockRejectedValue(voiceNoteApiError(409, "already_processing"));
    s.get.mockResolvedValue(note({ status: "processing" }));
    expect((await submitRecording(s, "b1", job)).status).toBe("processing");
  });

  it("lets any other failure through, and a repeat uses the same client_request_id", async () => {
    const s = service();
    s.create.mockRejectedValueOnce(new ApiError(0, null, NETWORK_MESSAGE)).mockResolvedValue(note());
    s.sendAudio.mockResolvedValue(note({ status: "processing" }));
    await expect(submitRecording(s, "b1", job)).rejects.toMatchObject({ status: 0 });
    await submitRecording(s, "b1", job);
    expect(s.create.mock.calls[0][1].clientRequestId).toBe(s.create.mock.calls[1][1].clientRequestId);
  });
});

describe("retryVoiceNote", () => {
  it("asks the server to retry", async () => {
    const s = service();
    s.retry.mockResolvedValue(note({ status: "processing" }));
    expect((await retryVoiceNote(s, "n1")).status).toBe("processing");
    expect(s.sendAudio).not.toHaveBeenCalled();
  });

  it("sends the phone's copy when the server no longer has the audio", async () => {
    const s = service();
    s.retry.mockRejectedValue(voiceNoteApiError(409, "audio_expired"));
    s.sendAudio.mockResolvedValue(note({ status: "processing" }));
    await retryVoiceNote(s, "n1", job.recording);
    expect(s.sendAudio).toHaveBeenCalledWith("n1", job.recording);
  });

  it("gives the audio_expired error back when the phone has no copy either", async () => {
    const s = service();
    s.retry.mockRejectedValue(voiceNoteApiError(409, "audio_expired"));
    await expect(retryVoiceNote(s, "n1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("the phone's copy of the audio", () => {
  beforeEach(() => mockDelete.mockReset());

  it("is deleted when the note is done, and a missing or undeletable file never throws", () => {
    rememberLocalRecording("n1", "file:///cache/one.m4a");
    forgetLocalRecording("n1");
    expect(mockDelete).toHaveBeenCalledWith("file:///cache/one.m4a");
    expect(localRecordingFor("n1")).toBeUndefined();
    expect(() => forgetLocalRecording("n1")).not.toThrow(); // already forgotten
    mockDelete.mockImplementationOnce(() => {
      throw new Error("gone");
    });
    rememberLocalRecording("n2", "file:///cache/two.m4a");
    expect(() => forgetLocalRecording("n2")).not.toThrow();
  });

  it("every recording is deleted at sign-out", () => {
    rememberLocalRecording("a", "file:///cache/a.m4a");
    rememberLocalRecording("b", "file:///cache/b.m4a");
    forgetAllLocalRecordings();
    expect(mockDelete).toHaveBeenCalledWith("file:///cache/a.m4a");
    expect(mockDelete).toHaveBeenCalledWith("file:///cache/b.m4a");
    expect(localRecordingFor("a")).toBeUndefined();
  });

  it("makes request ids that look like v4 uuids and differ", () => {
    const a = newRequestId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newRequestId()).not.toBe(a);
  });
});
