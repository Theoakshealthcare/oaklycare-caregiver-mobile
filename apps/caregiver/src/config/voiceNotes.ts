/**
 * Whether the voice note flow (record, transcribe, review, save) is on, and which service backs it.
 *
 *   off   the shipped behaviour: a recording is not sent anywhere and the caregiver types the note. THE DEFAULT, and it stays the
 *         default until the backend (backend/docs/plans/2026-11-07-ai-note-transcription.md) is deployed and switched on.
 *   fake  an in-memory service that returns sample text. For Jest, the simulator-less build and design review. Nothing leaves the
 *         phone, and the screen says so.
 *   live  the real service over the generated api-client: the recording is sent to the backend, which sends it to an external AI
 *         service. Only for a build pointed at a backend that has `VOICE_NOTES_ENABLED` on.
 *
 * Set at build time with `EXPO_PUBLIC_VOICE_NOTES=fake` or `live`; any other value, or none, means `off`.
 */
export type VoiceNotesMode = "off" | "fake" | "live";

export function voiceNotesMode(): VoiceNotesMode {
  const raw = process.env.EXPO_PUBLIC_VOICE_NOTES;
  return raw === "fake" || raw === "live" ? raw : "off";
}
