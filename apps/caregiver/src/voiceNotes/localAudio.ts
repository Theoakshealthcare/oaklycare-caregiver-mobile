import { File } from "expo-file-system";

/**
 * The recording file on the phone. The server deletes its copy of the audio as soon as the text is ready (owner decision D1),
 * so the phone does the same: the file is removed when the note becomes `ready`, on discard, and at sign-out.
 *
 * Until then the app KEEPS the file, because a retry after an expired server copy needs it (spec 3.4, `audio_expired`).
 */
const held = new Map<string, string>();

/** Best effort: a file that is already gone, or cannot be deleted, must never break the flow. */
export function deleteLocalFile(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // Nothing to do: the OS clears the cache directory on its own schedule.
  }
}

/** Remember which file belongs to a note, so a retry can send it again. */
export function rememberLocalRecording(noteId: string, uri: string): void {
  held.set(noteId, uri);
}

export function localRecordingFor(noteId: string): string | undefined {
  return held.get(noteId);
}

/** Delete the file of one note (ready, saved or discarded). */
export function forgetLocalRecording(noteId: string): void {
  const uri = held.get(noteId);
  if (uri === undefined) return;
  held.delete(noteId);
  deleteLocalFile(uri);
}

/** Delete every recording the app still holds (sign-out). */
export function forgetAllLocalRecordings(): void {
  for (const uri of held.values()) deleteLocalFile(uri);
  held.clear();
}

/** A random v4-style id for `client_request_id`. It makes a retry idempotent; it is not a secret. */
export function newRequestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
