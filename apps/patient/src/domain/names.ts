const TITLES = /^(dr|mr|mrs|ms|miss|nurse|prof)\.?$/i;

/** The words of a name with spacing cleaned up and any leading titles ("Dr.", "Nurse") dropped; all of them when nothing else is left. */
function nameWords(fullName: string): string[] {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const named = parts.filter((part) => !TITLES.test(part));
  return named.length > 0 ? named : parts;
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** "Dr. John Smith" is "John": most screens show the family a first name, not a title. */
export function firstNameOf(fullName: string): string {
  return nameWords(fullName)[0] ?? fullName;
}

/**
 * First name and the first letter of the last name, for the one screen where a person has to be told apart on a consent
 * choice ("Who can see my vitals"): "Adamu Titilayo" is "Adamu T.". A single word is shown as it is. Extra spaces, a title
 * and lowercase input are handled ("  dr.  adamu   titilayo " is "Adamu T."); a middle name is skipped.
 */
export function firstNameAndInitial(fullName: string): string {
  const words = nameWords(fullName);
  if (words.length === 0) return fullName.trim();
  if (words.length === 1) return words[0];
  const last = words[words.length - 1];
  return `${capitalise(words[0])} ${last.charAt(0).toUpperCase()}.`;
}
