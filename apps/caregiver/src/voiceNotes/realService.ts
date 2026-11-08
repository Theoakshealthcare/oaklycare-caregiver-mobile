import { File } from "expo-file-system";

import { api } from "@/src/api/client";
import { unwrap, unwrapEmpty } from "@/src/api/unwrap";

import type { VoiceNoteService } from "./service";
import { fromWire, type NewVoiceNote, type RecordingFile, type VoiceNote, type VoiceNoteText } from "./types";

/**
 * The real voice note service: one call per route of the contract, through the generated client. Every failure is an `ApiError`
 * whose body is `{ detail: { code, message } }` for the voice note routes (the voice note messages read `detail.code`).
 *
 * UNVERIFIED on a device and against the real backend + Gemini: Jest only (the calls are asserted against captured responses).
 */
export const realVoiceNoteService: VoiceNoteService = {
  async create(bookingId: string, input: NewVoiceNote): Promise<VoiceNote> {
    const note = await unwrap(
      api.POST("/api/v1/caregiver/visits/{booking_id}/voice-notes", {
        params: { path: { booking_id: bookingId } },
        body: {
          consent_confirmed: input.consentConfirmed,
          consent_version: input.consentVersion,
          language: input.language,
          duration_seconds: input.durationSeconds,
          client_request_id: input.clientRequestId,
        },
      }),
    );
    return fromWire(note);
  },

  async sendAudio(noteId: string, file: RecordingFile): Promise<VoiceNote> {
    // The audio is the raw request body (not multipart), sent by the client's plain-fetch path (never `api.PUT`, whose `Request`
    // wrapper is the trap of DP1-02). Reading the file is inside the promise, so a read failure is an app-side failure, not "can't
    // reach Oakly".
    const note = await unwrap(
      (async () => {
        const bytes = await new File(file.uri).bytes();
        return api.uploadBytes<import("@oakly/api-client").Schemas["VoiceNoteOut"]>(
          `/api/v1/caregiver/voice-notes/${encodeURIComponent(noteId)}/audio`,
          bytes,
          file.mime,
        );
      })(),
    );
    return fromWire(note);
  },

  async get(noteId: string): Promise<VoiceNote> {
    const note = await unwrap(api.GET("/api/v1/caregiver/voice-notes/{note_id}", { params: { path: { note_id: noteId } } }));
    return fromWire(note);
  },

  async listForVisit(bookingId: string): Promise<VoiceNote[]> {
    const list = await unwrap(
      api.GET("/api/v1/caregiver/visits/{booking_id}/voice-notes", { params: { path: { booking_id: bookingId } } }),
    );
    return list.items.map(fromWire);
  },

  async retry(noteId: string): Promise<VoiceNote> {
    const note = await unwrap(api.POST("/api/v1/caregiver/voice-notes/{note_id}/retry", { params: { path: { note_id: noteId } } }));
    return fromWire(note);
  },

  async save(noteId: string, text: VoiceNoteText): Promise<VoiceNote> {
    const note = await unwrap(
      api.PUT("/api/v1/caregiver/voice-notes/{note_id}", {
        params: { path: { note_id: noteId } },
        body: { transcript: text.transcript, summary: text.summary },
      }),
    );
    return fromWire(note);
  },

  async discard(noteId: string): Promise<void> {
    await unwrapEmpty(api.DELETE("/api/v1/caregiver/voice-notes/{note_id}", { params: { path: { note_id: noteId } } }));
  },
};
