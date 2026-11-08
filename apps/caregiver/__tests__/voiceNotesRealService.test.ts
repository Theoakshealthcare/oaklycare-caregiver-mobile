import { ApiError, FALLBACK_MESSAGE, NETWORK_MESSAGE } from "../src/api/errors";
import { voiceNotesMode } from "../src/config/voiceNotes";
import { CONSENT_VERSION } from "../src/voiceNotes/consentCopy";
import { FakeVoiceNoteService } from "../src/voiceNotes/fakeService";
import { FAILURE_MESSAGES, REQUEST_MESSAGES, requestCodeOf, voiceNoteErrorMessage } from "../src/voiceNotes/messages";
import { realVoiceNoteService as real } from "../src/voiceNotes/realService";
import { getVoiceNoteService, setVoiceNoteServiceForTests } from "../src/voiceNotes/service";
import { fromWire } from "../src/voiceNotes/types";
import { body, capture, type Capture } from "../test-utils/voiceNoteCaptures";

const mockBytes = jest.fn();
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation((uri: string) => ({ bytes: () => mockBytes(uri) })) }));

// The app's client captures `fetch` when it is created, so route it through a late-bound wrapper.
jest.mock("../src/api/client", () => {
  const { createOaklyClient } = jest.requireActual("@oakly/api-client");
  return {
    api: createOaklyClient({
      baseUrl: "http://test.local",
      getAccessToken: () => "access",
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    }),
  };
});

const json = (payload: unknown, status = 200) =>
  new Response(payload === null ? null : JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
const asResponse = (name: string) => json(body(name), capture(name).response.status_code);

let fetchMock: jest.SpyInstance;
beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, "fetch");
  mockBytes.mockReset().mockResolvedValue(new Uint8Array([0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70]));
});
afterEach(() => {
  fetchMock.mockRestore();
  setVoiceNoteServiceForTests(null);
});

const lastRequest = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as Request;

describe("real voice note service: wiring against the backend's captured responses", () => {
  it("creates a note with the consent, version, language, duration and request id (capture 01)", async () => {
    fetchMock.mockImplementation(async () => asResponse("01-create-201"));
    const note = await real.create("visit-1", {
      consentConfirmed: true,
      consentVersion: CONSENT_VERSION,
      language: "pcm",
      durationSeconds: 42,
      clientRequestId: "11111111-2222-4333-8444-555555555555",
    });
    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/visits/visit-1/voice-notes");
    expect(await lastRequest().clone().json()).toEqual(capture("01-create-201").request.body);
    expect(note).toMatchObject({ status: "awaiting_audio", language: "pcm", transcript: null, summary: null, error: null, ready_at: null });
  });

  it("accepts the 200 of a repeated create (capture 02)", async () => {
    fetchMock.mockImplementation(async () => asResponse("02-create-repeat-200"));
    await expect(real.create("visit-1", { consentConfirmed: true, consentVersion: CONSENT_VERSION, language: "pcm", durationSeconds: 42, clientRequestId: "x" })).resolves.toMatchObject({ status: "awaiting_audio" });
  });

  it("sends the audio as the raw body by plain fetch(url, init), with the file's own Content-Type and the bearer token (capture 15)", async () => {
    fetchMock.mockImplementation(async () => asResponse("15-audio-202"));
    const note = await real.sendAudio("note-1", { uri: "file:///cache/rec.m4a", mime: "audio/mp4" });
    expect(mockBytes).toHaveBeenCalledWith("file:///cache/rec.m4a");
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [unknown, RequestInit];
    expect(url).toBe("http://test.local/api/v1/caregiver/voice-notes/note-1/audio"); // a string: never a Request (the DP1-02 trap)
    expect(init.method).toBe("PUT");
    expect(init.body).toEqual(new Uint8Array([0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70]));
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("audio/mp4");
    expect(headers.Authorization).toBe("Bearer access");
    expect(note.status).toBe("processing");
  });

  it("reads a note: a ready draft, a ready draft without a summary, and a failed note (captures 18, 30, 24)", async () => {
    fetchMock.mockImplementation(async () => asResponse("18-poll-ready"));
    const ready = await real.get("note-1");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/voice-notes/note-1");
    expect(ready).toMatchObject({ status: "ready", summary_available: true, edited: false, error: null });
    expect(typeof ready.transcript).toBe("string");
    expect(typeof ready.summary).toBe("string");

    fetchMock.mockImplementation(async () => asResponse("30-poll-ready-without-summary"));
    expect(await real.get("note-2")).toMatchObject({ status: "ready", summary: null, summary_available: false });

    fetchMock.mockImplementation(async () => asResponse("24-poll-failed-no-speech"));
    const failed = await real.get("note-3");
    expect(failed).toMatchObject({ status: "failed", transcript: null, error: { code: "no_speech_detected", retryable: false } });
    expect(failed.error?.message).toBe(FAILURE_MESSAGES.no_speech_detected);
  });

  it("lists a visit's notes (capture 19)", async () => {
    fetchMock.mockImplementation(async () => asResponse("19-list-200"));
    const notes = await real.listForVisit("visit-1");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/visits/visit-1/voice-notes");
    expect(notes.map((n) => n.status)).toEqual(["ready"]); // captured before the caregiver saved
    expect(notes[0].transcript).toEqual(expect.any(String));
  });

  it("retries (capture 27)", async () => {
    fetchMock.mockImplementation(async () => asResponse("27-retry-202"));
    expect((await real.retry("note-1")).status).toBe("processing");
    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/voice-notes/note-1/retry");
  });

  it("saves the caregiver's text (capture 20) and answers edited", async () => {
    fetchMock.mockImplementation(async () => asResponse("20-save-200"));
    const saved = await real.save("note-1", capture("20-save-200").request.body as { transcript: string; summary: string });
    expect(lastRequest().method).toBe("PUT");
    expect(await lastRequest().clone().json()).toEqual(capture("20-save-200").request.body);
    expect(saved).toMatchObject({ status: "saved", edited: true, expires_at: null });
  });

  it("discards with a DELETE and a 204 (capture 31)", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    await expect(real.discard("note-1")).resolves.toBeUndefined();
    expect(lastRequest().method).toBe("DELETE");
    expect(lastRequest().url).toBe("http://test.local/api/v1/caregiver/voice-notes/note-1");
  });
});

describe("real voice note service: errors", () => {
  it("keeps the object detail of a refusal so detail.code can be read (captures 14, 16, 29)", async () => {
    for (const [name, code] of [["14-audio-too-large-413", "audio_too_large"], ["16-audio-again-409", "already_processing"], ["29-retry-audio-expired-409", "audio_expired"]] as const) {
      fetchMock.mockImplementation(async () => asResponse(name));
      const error = await real.sendAudio("note-1", { uri: "file:///a.m4a", mime: "audio/mp4" }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(capture(name).response.status_code);
      expect(requestCodeOf(error)).toBe(code);
      expect(voiceNoteErrorMessage(error)).toBe(REQUEST_MESSAGES[code]);
    }
  });

  it("an offline upload is 'can't reach Oakly' and a file that cannot be read is not blamed on the network", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Network request failed");
    });
    const offline = await real.sendAudio("note-1", { uri: "file:///a.m4a", mime: "audio/mp4" }).catch((e: unknown) => e);
    expect(voiceNoteErrorMessage(offline)).toBe(NETWORK_MESSAGE);

    mockBytes.mockRejectedValue(new Error("no such file"));
    const unreadable = await real.sendAudio("note-1", { uri: "file:///gone.m4a", mime: "audio/mp4" }).catch((e: unknown) => e);
    expect(unreadable).toBeInstanceOf(ApiError);
    expect(voiceNoteErrorMessage(unreadable)).toBe(FALLBACK_MESSAGE);
  });

  it("a 422 from the server (a list, no detail.code) falls back to the general wording", async () => {
    fetchMock.mockImplementation(async () => asResponse("05-create-missing-field-422"));
    const error = await real.create("visit-1", { consentConfirmed: true, consentVersion: CONSENT_VERSION, language: "en", durationSeconds: 10, clientRequestId: "x" }).catch((e: unknown) => e);
    expect(requestCodeOf(error)).toBeNull();
    expect(voiceNoteErrorMessage(error)).toBe("Field required");
  });
});

describe("the app's copy and the fake follow the captures", () => {
  // Every captured response whose body is `{ detail: { code, message } }` (a 4xx or 5xx of the voice routes).
  const ERROR_CAPTURES = [
    "03-consent-false-400",
    "04-consent-version-400",
    "07-create-visit-not-active-409",
    "08-create-not-found-404",
    "10-save-not-ready-409",
    "11-audio-empty-400",
    "12-audio-type-415",
    "13-audio-not-audio-415",
    "14-audio-too-large-413",
    "16-audio-again-409",
    "22-save-different-409",
    "25-retry-not-retryable-409",
    "29-retry-audio-expired-409",
    "32-delete-again-404",
    "34-patient-read-not-booker-404",
    "37-audio-daily-limit-429",
    "38-create-visit-limit-429",
    "39-create-switched-off-503",
  ];
  const errorCaptures: Array<Capture & { file: string }> = ERROR_CAPTURES.map((name) => ({ file: `${name}.json`, ...capture(name) }));

  it("has captured errors to compare (so this test cannot pass by finding none)", () => {
    expect(errorCaptures.length).toBeGreaterThan(10);
  });

  it.each(errorCaptures.map((c) => [c.file, c] as [string, Capture]))("%s: the server's code is one the app words, with the same sentence", (_file: string, c: Capture) => {
    const detail = (c.response.body as { detail: { code: string; message: string } }).detail;
    expect(Object.keys(REQUEST_MESSAGES)).toContain(detail.code);
    expect(REQUEST_MESSAGES[detail.code as keyof typeof REQUEST_MESSAGES]).toBe(detail.message);
  });

  it("the failure sentences are the captured ones", () => {
    for (const name of ["24-poll-failed-no-speech", "26-poll-failed-retryable"]) {
      const error = (body(name) as { error: { code: keyof typeof FAILURE_MESSAGES; message: string } }).error;
      expect(FAILURE_MESSAGES[error.code]).toBe(error.message);
    }
  });

  it("the fake answers the same fields as the real backend, in every state it can be in", async () => {
    const clock = { t: Date.UTC(2026, 10, 8, 10) };
    const fake = new FakeVoiceNoteService({ now: () => clock.t, processingMs: 100, script: [{ kind: "fail", code: "no_speech_detected" }] });
    const keys = (note: object) => Object.keys(note).sort();
    const create = { consentConfirmed: true as const, consentVersion: CONSENT_VERSION, language: "pcm" as const, durationSeconds: 42 };

    const awaiting = await fake.create("v", { ...create, clientRequestId: "a" });
    expect(keys(awaiting)).toEqual(keys(fromWire(body("01-create-201") as never)));
    expect(awaiting.error).toBeNull();

    await fake.sendAudio(awaiting.id, { uri: "file:///a.m4a", mime: "audio/mp4" });
    clock.t += 200;
    const failed = await fake.get(awaiting.id);
    expect(keys(failed)).toEqual(keys(fromWire(body("24-poll-failed-no-speech") as never)));
    expect(keys(failed.error as object)).toEqual(keys(fromWire(body("24-poll-failed-no-speech") as never).error as object));
    expect(failed.error?.message).toBe((body("24-poll-failed-no-speech").error as { message: string }).message);

    const ok = await fake.create("v", { ...create, clientRequestId: "b" });
    await fake.sendAudio(ok.id, { uri: "file:///a.m4a", mime: "audio/mp4" });
    clock.t += 200;
    const ready = await fake.get(ok.id);
    expect(keys(ready)).toEqual(keys(fromWire(body("18-poll-ready") as never)));
    expect(ready.summary_available).toBe(true);
    const saved = await fake.save(ok.id, { transcript: "Final text.", summary: "" });
    expect(keys(saved)).toEqual(keys(fromWire(body("20-save-200") as never)));
    expect(saved).toMatchObject({ status: "saved", expires_at: null, edited: true });
  });
});

describe("which service the screens get", () => {
  const original = process.env.EXPO_PUBLIC_VOICE_NOTES;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_VOICE_NOTES;
    else process.env.EXPO_PUBLIC_VOICE_NOTES = original;
  });

  it("is off unless the build says fake or live, and live is the real service", () => {
    delete process.env.EXPO_PUBLIC_VOICE_NOTES;
    expect(voiceNotesMode()).toBe("off");
    expect(() => getVoiceNoteService()).toThrow(/off/);
    process.env.EXPO_PUBLIC_VOICE_NOTES = "nonsense";
    expect(voiceNotesMode()).toBe("off");
    process.env.EXPO_PUBLIC_VOICE_NOTES = "fake";
    expect(getVoiceNoteService()).toBeInstanceOf(FakeVoiceNoteService);
    process.env.EXPO_PUBLIC_VOICE_NOTES = "live";
    expect(voiceNotesMode()).toBe("live");
    expect(getVoiceNoteService()).toBe(real);
  });
});
