/** Words for the caregiver's own documentation space (clinician pack, section 1). Private: never shown to the family. */
export const DOCUMENTATION_TITLE = "My documentation";
export const DOCUMENTATION_SUBTITLE =
  "Your own notes for this visit. Only you and the Oakly team can read them. The family does not see them.";
export const DOCUMENTATION_PLACEHOLDER = "Write your own documentation for this visit";
export const DOCUMENTATION_PERMANENT_HINT =
  "An entry can't be edited or deleted once you save it. To correct one, add a new entry.";
export const DOCUMENTATION_EMPTY = "You have not written anything for this visit yet.";
export const DOCUMENTATION_CLOSED = "You can no longer add to this visit's documentation.";
export const DOCUMENTATION_GONE = "This documentation is no longer available.";
export const DOCUMENTATION_MAX = 4000;

export function validateDocumentation(text: string): string | null {
  const body = text.trim();
  if (!body) return "Write something first.";
  if (body.length > DOCUMENTATION_MAX) return `Keep the entry to ${DOCUMENTATION_MAX} characters.`;
  return null;
}
