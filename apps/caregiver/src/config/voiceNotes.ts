/**
 * Whether the voice note flow (record, transcribe, review, save) is on, and which service backs it.
 *
 *   off   the shipped behaviour: a recording is not sent anywhere and the caregiver types the note. The default.
 *   fake  an in-memory service that returns sample text. For Jest, the simulator-less build and design review. Nothing
 *         leaves the phone, and the screen says so.
 *
 * TODO(phase-B): add `live` (the real service over the generated api-client, once the backend routes in
 * backend/docs/plans/2026-11-07-ai-note-transcription.md exist) and make it the default. Until then the real
 * endpoints do not exist, so this build has no way to send audio.
 *
 * Set at build time with `EXPO_PUBLIC_VOICE_NOTES=fake`; any other value, or none, means `off`.
 */
export type VoiceNotesMode = "off" | "fake";

export function voiceNotesMode(): VoiceNotesMode {
  return process.env.EXPO_PUBLIC_VOICE_NOTES === "fake" ? "fake" : "off";
}
