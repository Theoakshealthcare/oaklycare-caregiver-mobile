/** The country code every phone box starts with (the app serves Nigeria). */
export const PHONE_PREFIX = "+234";

/** E.164 allows 15 digits in all. */
const MAX_DIGITS = 15;

/**
 * Turns whatever was typed or pasted into the one stored shape, E.164 with the Nigerian code: the "+234" is always there and
 * a leading 0 or 234 is not doubled.
 *
 *   "08012345678" -> "+2348012345678"      "2348012345678" -> "+2348012345678"
 *   "8012345678"  -> "+2348012345678"      "+234 0801 234 5678" -> "+2348012345678"
 *   ""  "+"  "+23" (the prefix being deleted) -> "+234"
 *
 * A number that starts with another country's "+" code (a saved "+447911123456") is left alone, so editing it does not
 * corrupt it. Idempotent: normalising a normalised number changes nothing.
 */
export function normalizePhone(input: string): string {
  const text = input.trim();
  const plus = text.startsWith("+");
  const digits = text.replace(/\D/g, "").slice(0, MAX_DIGITS);

  // Less than a whole prefix left behind a "+" ("+", "+2", "+23", "+24"): the person is deleting into it, so it comes back whole.
  if (plus && digits.length < 4 && !digits.startsWith("0")) return PHONE_PREFIX;
  // Another country's number, typed with its own "+" code. A "+0..." is a local number typed with a stray plus.
  if (plus && digits.length >= 4 && !digits.startsWith("234") && !digits.startsWith("0")) return `+${digits}`;

  // "00234..." is the international form of the same code; a single 0 after the code or alone in front is the trunk zero.
  const international = digits.startsWith("00") ? digits.slice(2) : digits;
  const rest = international.startsWith("234") ? international.slice(3) : international;
  const national = rest.replace(/^0/, "");
  return `${PHONE_PREFIX}${national}`.slice(0, MAX_DIGITS + 1);
}

/**
 * How a number that is already stored (or kept in the booking draft) is shown. A clean E.164 number is shown as it is, so a saved
 * value is never altered just by opening the screen; anything else ("08012345678", "+234 801 ...", "") goes through `normalizePhone`.
 */
export function displayPhone(stored: string): string {
  const text = stored.trim();
  return /^\+\d{4,15}$/.test(text) ? text : normalizePhone(text);
}

/** The digits after the country code: what the person typed. "+234" alone, or nothing, is blank. */
export function nationalDigits(value: string): string {
  const phone = normalizePhone(value);
  return phone.startsWith(PHONE_PREFIX) ? phone.slice(PHONE_PREFIX.length) : phone.slice(1);
}

/** True while nothing but the prefix is there. */
export const isBlankPhone = (value: string): boolean => nationalDigits(value) === "";

/** A phone number needs at least seven digits after the country code. Same rule as before the prefix was shown. */
export function phoneProblem(value: string): string | undefined {
  if (isBlankPhone(value)) return "Phone number is required";
  return nationalDigits(value).length >= 7 ? undefined : "Enter a valid phone number";
}
