import { ApiError, messageForError } from "@/src/api/errors";

import type { VoiceNoteError, VoiceNoteFailureCode, VoiceNoteRequestCode } from "./types";

/** The sentence for each HTTP `detail.code` (the "Caregiver-facing message" column of spec 3.8). */
export const REQUEST_MESSAGES: Record<VoiceNoteRequestCode, string> = {
  consent_required: "Confirm the client agreed before recording.",
  consent_version_unknown: "Update the Oakly app to record notes.",
  audio_empty: "The recording is empty. Please record again.",
  not_found: "This note could not be found.",
  visit_not_active: "Voice notes can be added during a visit.",
  consent_missing: "Confirm the client agreed before recording.",
  already_processing: "This recording is already being processed.",
  invalid_state: "This note changed. Please refresh.",
  not_ready: "The note isn't ready to save yet.",
  already_saved: "This note is already saved.",
  audio_expired: "The recording is no longer stored. Please send it again.",
  audio_too_large: "That recording is too long. Keep notes under 10 minutes.",
  unsupported_audio_type: "This recording format isn't supported.",
  note_limit_reached: "You have reached the limit of voice notes for this visit.",
  daily_limit_reached: "You have reached today's limit of voice notes. Please type your note.",
  transcription_unavailable: "Voice notes are unavailable right now. Please type your note.",
};

/** The sentence for each failure code carried on a failed note (the table after spec 3.8). */
export const FAILURE_MESSAGES: Record<VoiceNoteFailureCode, string> = {
  transcription_failed: "We couldn't turn the recording into text. Try again.",
  transcription_timeout: "Transcription took too long. Try again.",
  provider_unavailable: "The voice service is busy. Try again in a moment.",
  no_speech_detected: "We couldn't hear any speech. Record again, or type your note.",
  audio_unsupported: "We couldn't read this recording. Record again, or type your note.",
  provider_blocked: "We couldn't process this recording. Please type your note.",
};

/** `detail.code` of an error from the voice note routes, or null (a network failure, a string `detail`, anything else). */
export function requestCodeOf(error: unknown): VoiceNoteRequestCode | null {
  if (!(error instanceof ApiError)) return null;
  const detail = error.body && typeof error.body === "object" ? (error.body as { detail?: unknown }).detail : undefined;
  const code = detail && typeof detail === "object" ? (detail as { code?: unknown }).code : undefined;
  return typeof code === "string" && code in REQUEST_MESSAGES ? (code as VoiceNoteRequestCode) : null;
}

/** A sentence for anything a voice note call threw: the code's own wording, else the app's general error wording. */
export function voiceNoteErrorMessage(error: unknown): string {
  const code = requestCodeOf(error);
  return code ? REQUEST_MESSAGES[code] : messageForError(error);
}

/** The sentence for a failed note. An unknown code falls back to what the server wrote, then to a general line. */
export function failureMessage(error: VoiceNoteError | null): string {
  if (!error) return "Something went wrong with this recording. Try again.";
  return FAILURE_MESSAGES[error.code] ?? (error.message || "Something went wrong with this recording. Try again.");
}
