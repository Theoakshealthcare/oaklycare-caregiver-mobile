/**
 * The consent copy the caregiver sees before the first recording of a visit (owner decision D2).
 *
 * The words and the version are the ones in backend/docs/plans/2026-11-07-ai-note-transcription.md section 11. They are a
 * v1 DRAFT that counsel must review before this ships; changing a word means a new version, which also makes every
 * remembered tick stop counting (see `useVisitConsent`). The text must say the audio goes to an external AI service.
 */
export const CONSENT_VERSION = "2026-11-v1";

export const CONSENT_TITLE = "Before you record";

/** The checkbox label: the confirmation itself. */
export const CONSENT_LINE =
  "The client has agreed to this visit being recorded. I understand Oakly sends the audio to an external AI service (Google Gemini) to turn it into text, and deletes the audio as soon as the text is ready.";

/** Shown under the checkbox. */
export const CONSENT_NOTE =
  "The text is stored securely and shared only with the client's care team and Oakly staff with clinical access.";
