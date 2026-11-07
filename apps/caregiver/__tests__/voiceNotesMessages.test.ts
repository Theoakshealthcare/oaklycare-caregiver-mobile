import { ApiError, NETWORK_MESSAGE } from "../src/api/errors";
import { CONSENT_LINE, CONSENT_NOTE, CONSENT_TITLE, CONSENT_VERSION } from "../src/voiceNotes/consentCopy";
import { FAILURE_MESSAGES, REQUEST_MESSAGES, failureMessage, requestCodeOf, voiceNoteErrorMessage } from "../src/voiceNotes/messages";

// The codes in backend/docs/plans/2026-11-07-ai-note-transcription.md section 3.8, written out so a code added or dropped
// on either side shows up here.
const SPEC_REQUEST_CODES = [
  "consent_required", "consent_version_unknown", "audio_empty", "not_found", "visit_not_active", "consent_missing",
  "already_processing", "invalid_state", "not_ready", "already_saved", "audio_expired", "audio_too_large",
  "unsupported_audio_type", "note_limit_reached", "daily_limit_reached", "transcription_unavailable",
];
const SPEC_FAILURE_CODES = [
  "transcription_failed", "transcription_timeout", "provider_unavailable", "no_speech_detected", "audio_unsupported", "provider_blocked",
];

describe("voice note messages", () => {
  it("has a sentence for every error code in the spec, and none the spec lacks", () => {
    expect(Object.keys(REQUEST_MESSAGES).sort()).toEqual([...SPEC_REQUEST_CODES].sort());
    expect(Object.keys(FAILURE_MESSAGES).sort()).toEqual([...SPEC_FAILURE_CODES].sort());
    for (const sentence of [...Object.values(REQUEST_MESSAGES), ...Object.values(FAILURE_MESSAGES)]) expect(sentence.length).toBeGreaterThan(10);
  });

  it("reads detail.code from the error body", () => {
    const error = new ApiError(409, { detail: { code: "not_ready", message: "server words" } }, "server words");
    expect(requestCodeOf(error)).toBe("not_ready");
    expect(voiceNoteErrorMessage(error)).toBe(REQUEST_MESSAGES.not_ready);
  });

  it("falls back to the app's general wording for a network failure, an unknown code and a plain error", () => {
    expect(voiceNoteErrorMessage(new ApiError(0, null, NETWORK_MESSAGE))).toBe(NETWORK_MESSAGE);
    expect(requestCodeOf(new ApiError(409, { detail: { code: "something_new" } }, "x"))).toBeNull();
    expect(requestCodeOf(new ApiError(404, { detail: "Care plan not found" }, "x"))).toBeNull();
    expect(requestCodeOf(new Error("boom"))).toBeNull();
  });

  it("describes a failed note by its error.code, and falls back for a code it does not know", () => {
    expect(failureMessage({ code: "no_speech_detected", message: "server", retryable: false })).toBe(FAILURE_MESSAGES.no_speech_detected);
    expect(failureMessage({ code: "brand_new" as never, message: "Server words.", retryable: false })).toBe("Server words.");
    expect(failureMessage(null)).toMatch(/Try again/);
  });
});

describe("consent copy", () => {
  // These literals are the words in the spec (section 11). If a word changes, the version must change with it.
  it("is the version-2026-11-v1 text from the spec and says the audio goes to an external AI service", () => {
    expect(CONSENT_VERSION).toBe("2026-11-v1");
    expect(CONSENT_TITLE).toBe("Before you record");
    expect(CONSENT_LINE).toBe(
      "The client has agreed to this visit being recorded. I understand Oakly sends the audio to an external AI service (Google Gemini) to turn it into text, and deletes the audio as soon as the text is ready.",
    );
    expect(CONSENT_NOTE).toBe("The text is stored securely and shared only with the client's care team and Oakly staff with clinical access.");
    expect(CONSENT_LINE).toMatch(/external AI service/);
  });
});
