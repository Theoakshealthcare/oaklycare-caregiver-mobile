import { ApiError } from "@/src/api/errors";

import { CONSENT_VERSION } from "./consentCopy";
import { FAILURE_MESSAGES, REQUEST_MESSAGES } from "./messages";
import {
  VOICE_NOTE_LIMITS,
  type NewVoiceNote,
  type RecordingFile,
  type VoiceNote,
  type VoiceNoteFailureCode,
  type VoiceNoteRequestCode,
  type VoiceNoteText,
} from "./types";
import type { VoiceNoteService } from "./service";

/** What the next transcription does. The fake takes one from the script per `sendAudio` or `retry`; default is success. */
export type FakeOutcome =
  | { kind: "success"; transcript?: string; summary?: string | null }
  | { kind: "fail"; code: VoiceNoteFailureCode; retryable?: boolean };

export interface FakeOptions {
  /** The clock, in epoch milliseconds. Tests pass their own so nothing depends on timers. */
  now?: () => number;
  /** How long a note stays `processing`. Time is checked when the note is read, so no timer ever runs. */
  processingMs?: number;
  script?: FakeOutcome[];
  /** A retryable failure whose stored audio is gone by the time of the retry (answers `audio_expired`). */
  audioExpiresAfterFailure?: boolean;
}

export const FAKE_TRANSCRIPT =
  "Sample transcript from the fake service. The client had breakfast and took the morning tablets. Blood pressure was one twenty over eighty.";
export const FAKE_SUMMARY = "Sample summary from the fake service: breakfast and tablets taken, blood pressure 120/80.";

/** The routes' error shape: `{ detail: { code, message } }`. */
export function voiceNoteApiError(status: number, code: VoiceNoteRequestCode): ApiError {
  const message = REQUEST_MESSAGES[code];
  return new ApiError(status, { detail: { code, message } }, message);
}

interface Row {
  note: VoiceNote;
  seq: number;
  clientRequestId: string;
  outcome: FakeOutcome | null;
  finishAt: number | null;
  audioStored: boolean;
  draft: VoiceNoteText | null;
}

const naiveUtc = (ms: number) => new Date(ms).toISOString().replace("Z", "");

/**
 * An in-memory stand-in for the voice note backend, following the contract in
 * backend/docs/plans/2026-11-07-ai-note-transcription.md (statuses, idempotent create, the state machine of 3.2-3.6, the error
 * codes of 3.8). It exists so the app can be built, tested and shown before the endpoints do. It sends nothing anywhere.
 */
export class FakeVoiceNoteService implements VoiceNoteService {
  private rows = new Map<string, Row>();
  private counter = 0;
  private readonly now: () => number;
  private readonly processingMs: number;
  private readonly script: FakeOutcome[];
  private readonly audioExpires: boolean;
  /** Every call made, in order (name and note or booking id), for tests. */
  readonly calls: Array<{ method: string; id: string }> = [];

  constructor(options: FakeOptions = {}) {
    this.now = options.now ?? Date.now;
    this.processingMs = options.processingMs ?? 1500;
    this.script = [...(options.script ?? [])];
    this.audioExpires = options.audioExpiresAfterFailure ?? false;
  }

  /** Queue the outcome of a later transcription. */
  enqueue(outcome: FakeOutcome): void {
    this.script.push(outcome);
  }

  private row(noteId: string): Row {
    const found = this.rows.get(noteId);
    if (!found) throw voiceNoteApiError(404, "not_found");
    this.settle(found);
    return found;
  }

  private settle(row: Row): void {
    const { note } = row;
    if (note.status !== "processing" || row.finishAt === null || this.now() < row.finishAt) return;
    const outcome = row.outcome ?? { kind: "success" };
    const at = naiveUtc(this.now());
    if (outcome.kind === "success") {
      const summary = outcome.summary === undefined ? FAKE_SUMMARY : outcome.summary;
      const transcript = outcome.transcript ?? FAKE_TRANSCRIPT;
      row.draft = { transcript, summary: summary ?? "" };
      row.audioStored = false; // the audio is deleted the moment the transcript is stored (owner decision D1)
      row.note = {
        ...note,
        status: "ready",
        transcript,
        summary,
        summary_available: summary !== null,
        error: null,
        ready_at: at,
        expires_at: naiveUtc(this.now() + 24 * 3_600_000),
      };
    } else {
      const retryable = outcome.retryable ?? ["transcription_failed", "transcription_timeout", "provider_unavailable"].includes(outcome.code);
      row.audioStored = retryable && !this.audioExpires;
      row.note = {
        ...note,
        status: "failed",
        error: { code: outcome.code, message: FAILURE_MESSAGES[outcome.code], retryable },
      };
    }
    row.finishAt = null;
  }

  private startProcessing(row: Row): void {
    row.outcome = this.script.shift() ?? { kind: "success" };
    row.finishAt = this.now() + this.processingMs;
    row.note = { ...row.note, status: "processing", error: null };
  }

  async create(bookingId: string, input: NewVoiceNote): Promise<VoiceNote> {
    this.calls.push({ method: "create", id: bookingId });
    if (input.consentConfirmed !== true) throw voiceNoteApiError(400, "consent_required");
    if (input.consentVersion !== CONSENT_VERSION) throw voiceNoteApiError(400, "consent_version_unknown");
    const existing = [...this.rows.values()].find((r) => r.note.booking_id === bookingId && r.clientRequestId === input.clientRequestId);
    if (existing) return { ...this.row(existing.note.id).note };
    if (input.durationSeconds < VOICE_NOTE_LIMITS.minSeconds || input.durationSeconds > VOICE_NOTE_LIMITS.maxSeconds) {
      throw new ApiError(422, { detail: [{ loc: ["body", "duration_seconds"], msg: "Out of range", type: "value_error" }] }, "Check the recording length.");
    }
    const at = naiveUtc(this.now());
    this.counter += 1;
    const note: VoiceNote = {
      id: `fake-note-${this.counter}`,
      booking_id: bookingId,
      status: "awaiting_audio",
      language: input.language,
      transcript: null,
      summary: null,
      summary_available: false,
      edited: false,
      error: null,
      duration_seconds: input.durationSeconds,
      consent_version: input.consentVersion,
      consent_confirmed_at: at,
      created_at: at,
      ready_at: null,
      saved_at: null,
      expires_at: null,
    };
    this.rows.set(note.id, { note, seq: this.counter, clientRequestId: input.clientRequestId, outcome: null, finishAt: null, audioStored: false, draft: null });
    return { ...note };
  }

  async sendAudio(noteId: string, file: RecordingFile): Promise<VoiceNote> {
    this.calls.push({ method: "sendAudio", id: noteId });
    const row = this.row(noteId);
    const { status } = row.note;
    if (status === "processing") throw voiceNoteApiError(409, "already_processing");
    if (status === "ready" || status === "saved") throw voiceNoteApiError(409, "invalid_state");
    if (!file.uri) throw voiceNoteApiError(400, "audio_empty");
    row.audioStored = true;
    this.startProcessing(row);
    return { ...row.note };
  }

  async get(noteId: string): Promise<VoiceNote> {
    this.calls.push({ method: "get", id: noteId });
    return { ...this.row(noteId).note };
  }

  async listForVisit(bookingId: string): Promise<VoiceNote[]> {
    this.calls.push({ method: "listForVisit", id: bookingId });
    return [...this.rows.values()]
      .filter((r) => r.note.booking_id === bookingId)
      .map((r) => {
        this.settle(r);
        return r;
      })
      .sort((a, b) => b.seq - a.seq)
      .map((r) => ({ ...r.note }));
  }

  async retry(noteId: string): Promise<VoiceNote> {
    this.calls.push({ method: "retry", id: noteId });
    const row = this.row(noteId);
    if (row.note.status !== "failed" || !row.note.error?.retryable) throw voiceNoteApiError(409, "invalid_state");
    if (!row.audioStored) throw voiceNoteApiError(409, "audio_expired");
    this.startProcessing(row);
    return { ...row.note };
  }

  async save(noteId: string, text: VoiceNoteText): Promise<VoiceNote> {
    this.calls.push({ method: "save", id: noteId });
    const row = this.row(noteId);
    const transcript = text.transcript.trim();
    const summary = text.summary.trim();
    if (row.note.status === "saved") {
      if (row.note.transcript === transcript && (row.note.summary ?? "") === summary) return { ...row.note };
      throw voiceNoteApiError(409, "already_saved");
    }
    if (row.note.status !== "ready") throw voiceNoteApiError(409, "not_ready");
    if (transcript.length < 1 || transcript.length > VOICE_NOTE_LIMITS.transcriptMax || summary.length > VOICE_NOTE_LIMITS.summaryMax) {
      throw new ApiError(422, { detail: [{ loc: ["body"], msg: "Check the text length", type: "value_error" }] }, "Check the text.");
    }
    const edited = transcript !== row.draft?.transcript.trim() || summary !== (row.draft?.summary ?? "").trim();
    row.note = {
      ...row.note,
      status: "saved",
      transcript,
      summary,
      summary_available: true,
      edited,
      saved_at: naiveUtc(this.now()),
      expires_at: null,
    };
    return { ...row.note };
  }

  async discard(noteId: string): Promise<void> {
    this.calls.push({ method: "discard", id: noteId });
    if (!this.rows.delete(noteId)) throw voiceNoteApiError(404, "not_found");
  }

  /** For tests: whether the fake still holds the audio of a note (it never does once the note is ready). */
  holdsAudio(noteId: string): boolean {
    return this.rows.get(noteId)?.audioStored ?? false;
  }
}
