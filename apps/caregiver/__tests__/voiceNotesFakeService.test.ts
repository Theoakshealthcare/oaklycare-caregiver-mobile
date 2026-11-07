import { FAKE_SUMMARY, FAKE_TRANSCRIPT, FakeVoiceNoteService } from "../src/voiceNotes/fakeService";
import { requestCodeOf } from "../src/voiceNotes/messages";
import { CONSENT_VERSION } from "../src/voiceNotes/consentCopy";
import type { NewVoiceNote } from "../src/voiceNotes/types";

/**
 * The fake follows the contract in backend/docs/plans/2026-11-07-ai-note-transcription.md section 3. These tests pin the
 * parts the app relies on, so the fake cannot drift from the spec without a test saying so.
 */
const FILE = { uri: "file:///cache/rec.m4a", mime: "audio/mp4" };
const input = (over: Partial<NewVoiceNote> = {}): NewVoiceNote => ({
  consentConfirmed: true,
  consentVersion: CONSENT_VERSION,
  language: "en",
  durationSeconds: 42,
  clientRequestId: "req-1",
  ...over,
});

function setup(options: ConstructorParameters<typeof FakeVoiceNoteService>[0] = {}) {
  const clock = { t: Date.UTC(2026, 10, 7, 10, 0, 0) };
  const service = new FakeVoiceNoteService({ now: () => clock.t, processingMs: 1000, ...options });
  return { clock, service };
}

const codeOf = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return requestCodeOf(error);
  }
  return "no error";
};

describe("FakeVoiceNoteService follows the contract", () => {
  it("creates a note in awaiting_audio and stores the consent version; create is idempotent on client_request_id", async () => {
    const { service } = setup();
    const first = await service.create("b1", input());
    expect(first).toMatchObject({ status: "awaiting_audio", booking_id: "b1", consent_version: CONSENT_VERSION, language: "en", transcript: null, summary: null, error: null });
    expect(first.consent_confirmed_at).not.toMatch(/Z$/); // naive UTC, like the backend
    const again = await service.create("b1", input());
    expect(again.id).toBe(first.id);
    const other = await service.create("b1", input({ clientRequestId: "req-2" }));
    expect(other.id).not.toBe(first.id);
  });

  it("refuses a recording without consent or with an unknown consent version, using detail.code", async () => {
    const { service } = setup();
    expect(await codeOf(service.create("b1", { ...input(), consentConfirmed: false as unknown as true }))).toBe("consent_required");
    expect(await codeOf(service.create("b1", input({ consentVersion: "2020-01-v0" })))).toBe("consent_version_unknown");
  });

  it("goes processing, then ready with the draft; the audio is dropped as soon as the text exists", async () => {
    const { clock, service } = setup();
    const note = await service.create("b1", input());
    const sent = await service.sendAudio(note.id, FILE);
    expect(sent.status).toBe("processing");
    expect(service.holdsAudio(note.id)).toBe(true);
    expect((await service.get(note.id)).status).toBe("processing");
    clock.t += 1000;
    const ready = await service.get(note.id);
    expect(ready).toMatchObject({ status: "ready", transcript: FAKE_TRANSCRIPT, summary: FAKE_SUMMARY, summary_available: true, edited: false });
    expect(ready.expires_at).not.toBeNull();
    expect(service.holdsAudio(note.id)).toBe(false);
  });

  it("answers already_processing, invalid_state and audio_empty for the wrong send", async () => {
    const { clock, service } = setup();
    const note = await service.create("b1", input());
    expect(await codeOf(service.sendAudio(note.id, { uri: "", mime: "audio/mp4" }))).toBe("audio_empty");
    await service.sendAudio(note.id, FILE);
    expect(await codeOf(service.sendAudio(note.id, FILE))).toBe("already_processing");
    clock.t += 1000;
    expect(await codeOf(service.sendAudio(note.id, FILE))).toBe("invalid_state");
  });

  it("a retryable failure keeps the audio so retry works; a non-retryable one does not offer retry", async () => {
    const { clock, service } = setup({ script: [{ kind: "fail", code: "provider_unavailable" }, { kind: "fail", code: "no_speech_detected" }] });
    const a = await service.create("b1", input());
    await service.sendAudio(a.id, FILE);
    clock.t += 1000;
    const failed = await service.get(a.id);
    expect(failed).toMatchObject({ status: "failed", transcript: null, error: { code: "provider_unavailable", retryable: true } });
    expect(service.holdsAudio(a.id)).toBe(true);
    expect((await service.retry(a.id)).status).toBe("processing");
    clock.t += 1000;
    expect((await service.get(a.id)).status).toBe("failed"); // second scripted outcome
    const final = await service.get(a.id);
    expect(final.error).toMatchObject({ code: "no_speech_detected", retryable: false });
    expect(await codeOf(service.retry(a.id))).toBe("invalid_state");
  });

  it("retry after the stored audio expired answers audio_expired; sending the audio again then works", async () => {
    const { clock, service } = setup({ script: [{ kind: "fail", code: "transcription_failed" }], audioExpiresAfterFailure: true });
    const note = await service.create("b1", input());
    await service.sendAudio(note.id, FILE);
    clock.t += 1000;
    expect((await service.get(note.id)).status).toBe("failed");
    expect(await codeOf(service.retry(note.id))).toBe("audio_expired");
    expect((await service.sendAudio(note.id, FILE)).status).toBe("processing");
  });

  it("saves only from ready: not_ready before, edited reflects a change, the same text again is fine, different text is already_saved", async () => {
    const { clock, service } = setup();
    const note = await service.create("b1", input());
    await service.sendAudio(note.id, FILE);
    expect(await codeOf(service.save(note.id, { transcript: "x", summary: "" }))).toBe("not_ready");
    clock.t += 1000;
    const saved = await service.save(note.id, { transcript: "  Corrected text.  ", summary: "" });
    expect(saved).toMatchObject({ status: "saved", transcript: "Corrected text.", summary: "", edited: true, expires_at: null });
    expect(saved.saved_at).not.toBeNull();
    expect((await service.save(note.id, { transcript: "Corrected text.", summary: "" })).status).toBe("saved");
    expect(await codeOf(service.save(note.id, { transcript: "Other", summary: "" }))).toBe("already_saved");
  });

  it("saving the draft unchanged is not marked edited; an empty transcript is a 422", async () => {
    const { clock, service } = setup();
    const note = await service.create("b1", input());
    await service.sendAudio(note.id, FILE);
    clock.t += 1000;
    await expect(service.save(note.id, { transcript: "   ", summary: "" })).rejects.toMatchObject({ status: 422 });
    expect((await service.save(note.id, { transcript: FAKE_TRANSCRIPT, summary: FAKE_SUMMARY })).edited).toBe(false);
  });

  it("a ready note whose summary failed has summary null and summary_available false", async () => {
    const { clock, service } = setup({ script: [{ kind: "success", summary: null }] });
    const note = await service.create("b1", input());
    await service.sendAudio(note.id, FILE);
    clock.t += 1000;
    expect(await service.get(note.id)).toMatchObject({ status: "ready", summary: null, summary_available: false });
  });

  it("discard deletes the note; a second discard and any read is not_found", async () => {
    const { service } = setup();
    const note = await service.create("b1", input());
    await service.discard(note.id);
    expect(await codeOf(service.discard(note.id))).toBe("not_found");
    expect(await codeOf(service.get(note.id))).toBe("not_found");
    expect(await service.listForVisit("b1")).toEqual([]);
  });

  it("lists only the visit's notes, newest first", async () => {
    const { service } = setup();
    const one = await service.create("b1", input({ clientRequestId: "a" }));
    const two = await service.create("b1", input({ clientRequestId: "b" }));
    await service.create("b2", input({ clientRequestId: "c" }));
    expect((await service.listForVisit("b1")).map((n) => n.id)).toEqual([two.id, one.id]);
  });

  it("errors carry the documented body shape { detail: { code, message } }", async () => {
    const { service } = setup();
    await expect(service.get("nope")).rejects.toMatchObject({ status: 404, body: { detail: { code: "not_found", message: expect.any(String) } } });
  });
});
