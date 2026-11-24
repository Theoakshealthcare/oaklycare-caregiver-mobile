/**
 * Phone numbers in the caregiver app are Nigerian E.164 ("+2348012345678"). Every phone field starts as "+234" and the
 * prefix cannot be deleted, so only the national number is typed. These helpers are the one place that rule lives.
 */
export const PHONE_PREFIX = "+234";

/** E.164 allows 15 digits in all; three of them are the country code. */
const MAX_NATIONAL_DIGITS = 12;
/** A Nigerian national number (without the leading 0) is 10 digits, so a longer run starting 234 is a country code pasted twice. */
const NATIONAL_LENGTH = 10;

/**
 * What a phone field shows for whatever the user typed or pasted: always "+234" followed by the national number.
 * - deleting into the prefix puts it back ("", "+", "+2", "+23" -> "+234");
 * - a typed leading 0 is dropped ("+2340801..." -> "+234801...");
 * - a country code typed or pasted as "234..." or "+234..." (even on top of the prefix) is not doubled;
 * - anything that is not a digit is ignored.
 */
export function formatPhoneInput(raw: string): string {
  const text = raw.trim();
  if (PHONE_PREFIX.startsWith(text)) return PHONE_PREFIX;

  let national = text.replace(/\D/g, "");
  if (national.startsWith("234")) national = national.slice(3);
  // Pasting "+2348012345678" onto the "+234" already in the field leaves the code twice.
  if (national.startsWith("234") && national.length > NATIONAL_LENGTH) national = national.slice(3);
  national = national.replace(/^0+/, "").slice(0, MAX_NATIONAL_DIGITS);
  return PHONE_PREFIX + national;
}

/** True for a saved number from another country ("+447..."): it is shown as saved, never rewritten as Nigerian. */
export function isForeignNumber(saved: string | null | undefined): boolean {
  const text = (saved ?? "").trim();
  if (!text.startsWith("+")) return false;
  return !text.replace(/\D/g, "").startsWith("234");
}

/**
 * The value to put in a phone field for a number saved on the server: blank becomes the bare prefix, "0801..." and
 * "234801..." become "+234801...", a number from another country is kept as saved.
 */
export function toPhoneFieldValue(saved: string | null | undefined): string {
  if (isForeignNumber(saved)) return (saved ?? "").trim();
  return formatPhoneInput(saved ?? "");
}

/** True when the field holds nothing but the prefix (or nothing at all). */
export function isPhoneBlank(value: string): boolean {
  return value.replace(/\D/g, "").replace(/^234/, "").length === 0;
}

/** The E.164 string to send: "" when only the prefix was left, so callers can skip the field as they skip any blank one. */
export function phoneForSave(value: string): string {
  return isPhoneBlank(value) ? "" : value.trim();
}
