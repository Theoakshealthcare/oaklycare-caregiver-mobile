import { voiceNotesMode } from "@/src/config/voiceNotes";

import { FakeVoiceNoteService } from "./fakeService";
import { realVoiceNoteService } from "./realService";
import type { NewVoiceNote, RecordingFile, VoiceNote, VoiceNoteText } from "./types";

/**
 * Everything the app asks of the voice note backend. One method per route of the contract
 * (backend/docs/plans/2026-11-07-ai-note-transcription.md section 3). Every method either resolves or throws an
 * `ApiError` whose body is `{ detail: { code, message } }`.
 *
 * `realVoiceNoteService` (realService.ts) is the live one; `FakeVoiceNoteService` stays for tests and the `fake` mode.
 */
export interface VoiceNoteService {
  /** POST /caregiver/visits/{booking_id}/voice-notes. Records the consent; idempotent on `clientRequestId`. */
  create(bookingId: string, input: NewVoiceNote): Promise<VoiceNote>;
  /** PUT /caregiver/voice-notes/{note_id}/audio. Raw body. Resolves with the note in `processing`. */
  sendAudio(noteId: string, file: RecordingFile): Promise<VoiceNote>;
  /** GET /caregiver/voice-notes/{note_id}. The poll. */
  get(noteId: string): Promise<VoiceNote>;
  /** GET /caregiver/visits/{booking_id}/voice-notes. The caller's own notes for the visit, newest first. */
  listForVisit(bookingId: string): Promise<VoiceNote[]>;
  /** POST /caregiver/voice-notes/{note_id}/retry. Only for a retryable failure whose audio is still stored. */
  retry(noteId: string): Promise<VoiceNote>;
  /** PUT /caregiver/voice-notes/{note_id}. Saves the caregiver's version. */
  save(noteId: string, text: VoiceNoteText): Promise<VoiceNote>;
  /** DELETE /caregiver/voice-notes/{note_id}. Deletes the note's text and stored audio on the server. */
  discard(noteId: string): Promise<void>;
}

let fake: FakeVoiceNoteService | null = null;
let override: VoiceNoteService | null = null;

/** The service the screens use. Only called when `voiceNotesMode()` is not `off`. */
export function getVoiceNoteService(): VoiceNoteService {
  if (override) return override;
  if (voiceNotesMode() === "live") return realVoiceNoteService;
  if (voiceNotesMode() === "fake") {
    fake ??= new FakeVoiceNoteService();
    return fake;
  }
  throw new Error("Voice notes are off: getVoiceNoteService was called while EXPO_PUBLIC_VOICE_NOTES is not fake or live.");
}

/** Tests and previews swap the service here; pass null to go back to the configured one. */
export function setVoiceNoteServiceForTests(service: VoiceNoteService | null): void {
  override = service;
  if (service === null) fake = null;
}
