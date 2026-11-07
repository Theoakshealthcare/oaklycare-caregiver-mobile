import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { voiceNotesMode } from "@/src/config/voiceNotes";
import { CONSENT_VERSION } from "@/src/voiceNotes/consentCopy";
import { forgetLocalRecording, localRecordingFor, rememberLocalRecording } from "@/src/voiceNotes/localAudio";
import { requestCodeOf } from "@/src/voiceNotes/messages";
import { getVoiceNoteService, type VoiceNoteService } from "@/src/voiceNotes/service";
import type { RecordingFile, VoiceNote, VoiceNoteLanguage, VoiceNoteText } from "@/src/voiceNotes/types";

/** A voice note is health data: it leaves memory 2 minutes after the screen is done with it (same rule as care plans). */
const GC_TIME = 2 * 60_000;

/** The caregiver's own voice notes of a visit, newest first. Does nothing while the feature is off. */
export function useVisitVoiceNotes(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.voiceNotes(bookingId),
    queryFn: () => getVoiceNoteService().listForVisit(bookingId),
    enabled: voiceNotesMode() !== "off",
    gcTime: GC_TIME,
  });
}

/**
 * One note. With `poll`, it is read again while the note is being transcribed: every 2 s for the first ten reads, then
 * every 5 s (spec 3.4). It stops by itself once the note is anything but `processing` or `awaiting_audio`.
 */
export function useVoiceNote(noteId: string | undefined, poll = false) {
  return useQuery({
    queryKey: queryKeys.voiceNote(noteId ?? "none"),
    queryFn: () => getVoiceNoteService().get(noteId as string),
    enabled: voiceNotesMode() !== "off" && noteId !== undefined,
    gcTime: GC_TIME,
    refetchInterval: (query) => {
      if (!poll) return false;
      const status = query.state.data?.status;
      if (status !== undefined && status !== "processing" && status !== "awaiting_audio") return false;
      return query.state.dataUpdateCount < 10 ? 2_000 : 5_000;
    },
  });
}

/** One recording the caregiver wants to turn into text. Keeping the same `clientRequestId` makes every retry safe. */
export interface RecordingJob {
  clientRequestId: string;
  recording: RecordingFile;
  durationSeconds: number;
  language: VoiceNoteLanguage;
}

/**
 * Create the note (this stores the consent), then send the audio. Both steps are safe to run again: create is idempotent
 * on `clientRequestId`, and a second send answering `already_processing` just means the first one got through.
 */
export async function submitRecording(service: VoiceNoteService, bookingId: string, job: RecordingJob): Promise<VoiceNote> {
  const note = await service.create(bookingId, {
    consentConfirmed: true,
    consentVersion: CONSENT_VERSION,
    language: job.language,
    durationSeconds: job.durationSeconds,
    clientRequestId: job.clientRequestId,
  });
  // The note exists from here on, so a retry can find its file by the note id.
  rememberLocalRecording(note.id, job.recording.uri);
  if (note.status !== "awaiting_audio") return note; // an earlier attempt already sent the audio
  try {
    return await service.sendAudio(note.id, job.recording);
  } catch (error) {
    if (requestCodeOf(error) === "already_processing") return service.get(note.id);
    throw error;
  }
}

/** Ask the server to run a failed note again; if it no longer holds the audio, send the phone's copy instead. */
export async function retryVoiceNote(service: VoiceNoteService, noteId: string, recording?: RecordingFile): Promise<VoiceNote> {
  try {
    return await service.retry(noteId);
  } catch (error) {
    if (requestCodeOf(error) === "audio_expired" && recording) return service.sendAudio(noteId, recording);
    throw error;
  }
}

function useCacheUpdater(bookingId: string) {
  const client = useQueryClient();
  return (note: VoiceNote) => {
    client.setQueryData(queryKeys.voiceNote(note.id), note);
    void client.invalidateQueries({ queryKey: queryKeys.voiceNotes(bookingId) });
  };
}

/** Upload a recording: create the note, then send the audio. Resolves with the note in `processing`. */
export function useSubmitRecording(bookingId: string) {
  const update = useCacheUpdater(bookingId);
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (job: RecordingJob) => submitRecording(getVoiceNoteService(), bookingId, job),
    onSuccess: update,
  });
}

/** Try a failed note again. */
export function useRetryVoiceNote(bookingId: string) {
  const update = useCacheUpdater(bookingId);
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (noteId: string) => {
      const uri = localRecordingFor(noteId);
      return retryVoiceNote(getVoiceNoteService(), noteId, uri ? { uri, mime: "audio/mp4" } : undefined);
    },
    onSuccess: update,
  });
}

/** Save the caregiver's version of a `ready` note. */
export function useSaveVoiceNote(bookingId: string) {
  const update = useCacheUpdater(bookingId);
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: (vars: { noteId: string; text: VoiceNoteText }) => getVoiceNoteService().save(vars.noteId, vars.text),
    onSuccess: (note) => {
      forgetLocalRecording(note.id);
      update(note);
    },
  });
}

/** Discard a note: deletes its text and stored audio on the server, then the file on the phone. A note already gone is success. */
export function useDiscardVoiceNote(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: GC_TIME,
    mutationFn: async (noteId: string) => {
      try {
        await getVoiceNoteService().discard(noteId);
      } catch (error) {
        if (requestCodeOf(error) !== "not_found") throw error;
      }
      forgetLocalRecording(noteId);
      return noteId;
    },
    onSuccess: (noteId) => {
      client.removeQueries({ queryKey: queryKeys.voiceNote(noteId) });
      void client.invalidateQueries({ queryKey: queryKeys.voiceNotes(bookingId) });
    },
  });
}
