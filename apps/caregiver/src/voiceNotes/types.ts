import type { Schemas } from "@oakly/api-client";

/**
 * The voice note types the screens use. The wire shape is the generated `Schemas["VoiceNoteOut"]` (contract:
 * backend/docs/plans/2026-11-07-ai-note-transcription.md section 3, FE guide docs/fe-integration-guide-caregiver-ai-notes.md in the
 * backend). `fromWire` turns it into `VoiceNote` (every nullable field present, the failure code narrowed), and takes the generated
 * type as its parameter, so a backend change that renames or drops a field breaks the build here.
 */

/** `awaiting_audio` row made, no audio yet; `processing` being transcribed; `ready` a draft to review; `failed`; `saved` final. */
export type VoiceNoteStatus = "awaiting_audio" | "processing" | "ready" | "failed" | "saved";

/** English or Nigerian Pidgin (owner decision D4). */
export type VoiceNoteLanguage = "en" | "pcm";

/** `error.code` on a failed note (spec 3.8). */
export type VoiceNoteFailureCode =
  | "transcription_failed"
  | "transcription_timeout"
  | "provider_unavailable"
  | "no_speech_detected"
  | "audio_unsupported"
  | "provider_blocked";

/** `detail.code` of an HTTP error from the voice note routes (spec 3.8). */
export type VoiceNoteRequestCode =
  | "consent_required"
  | "consent_version_unknown"
  | "audio_empty"
  | "not_found"
  | "visit_not_active"
  | "consent_missing"
  | "already_processing"
  | "invalid_state"
  | "not_ready"
  | "already_saved"
  | "audio_expired"
  | "audio_too_large"
  | "unsupported_audio_type"
  | "note_limit_reached"
  | "daily_limit_reached"
  | "transcription_unavailable";

export interface VoiceNoteError {
  code: VoiceNoteFailureCode;
  message: string;
  retryable: boolean;
}

/** The `VoiceNote` object (spec 3.1). Timestamps are naive UTC ISO strings: read them with `parseBackendDate`. */
export interface VoiceNote {
  id: string;
  booking_id: string;
  status: VoiceNoteStatus;
  language: VoiceNoteLanguage;
  /** Null unless `ready` or `saved`. */
  transcript: string | null;
  /** Null unless `ready` or `saved`; also null when only the summary step failed (`summary_available` false). */
  summary: string | null;
  summary_available: boolean;
  edited: boolean;
  error: VoiceNoteError | null;
  duration_seconds: number;
  consent_version: string;
  consent_confirmed_at: string;
  created_at: string;
  ready_at: string | null;
  saved_at: string | null;
  expires_at: string | null;
}

/** Body of the create call (spec 3.2). `consentConfirmed` can only be `true`: the app never sends a recording without it. */
export interface NewVoiceNote {
  consentConfirmed: true;
  consentVersion: string;
  language: VoiceNoteLanguage;
  durationSeconds: number;
  /** Makes create idempotent: the same key returns the same note. One per recording. */
  clientRequestId: string;
}

/** The recording file on the phone. */
export interface RecordingFile {
  uri: string;
  mime: string;
}

/** The caregiver's text on save (spec 3.5). */
export interface VoiceNoteText {
  transcript: string;
  summary: string;
}

/** Limits from spec 5.1 and 3.5; the server enforces them too. */
export const VOICE_NOTE_LIMITS = {
  minSeconds: 2,
  maxSeconds: 600,
  transcriptMax: 20_000,
  summaryMax: 2_000,
} as const;

/**
 * What the phone's recorder writes (m4a / AAC). UNVERIFIED against the real Gemini (plan risk R3): the first live smoke run with a
 * real device recording decides whether the backend accepts it.
 */
export const RECORDING_MIME = "audio/mp4";

/** The wire note as the screens use it: absent nullable fields become `null`, the failure code is narrowed to the known union. */
export function fromWire(note: Schemas["VoiceNoteOut"]): VoiceNote {
  return {
    id: note.id,
    booking_id: note.booking_id,
    status: note.status,
    language: note.language,
    transcript: note.transcript ?? null,
    summary: note.summary ?? null,
    summary_available: note.summary_available,
    edited: note.edited,
    error: note.error
      ? { code: note.error.code as VoiceNoteFailureCode, message: note.error.message, retryable: note.error.retryable }
      : null,
    duration_seconds: note.duration_seconds,
    consent_version: note.consent_version,
    consent_confirmed_at: note.consent_confirmed_at,
    created_at: note.created_at,
    ready_at: note.ready_at ?? null,
    saved_at: note.saved_at ?? null,
    expires_at: note.expires_at ?? null,
  };
}
