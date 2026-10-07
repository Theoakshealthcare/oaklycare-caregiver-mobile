/** From the contact-us design. */
export const CONTACT_EMAIL = "info@theoakshealthcare.com";

// CONTENT: owner to supply. The WhatsApp support number is not decided yet; leave empty until it is
// (international format, for example "+234..."). While empty the Contact screen shows WhatsApp as
// "Not available yet" instead of linking anywhere.
export const WHATSAPP_NUMBER = "";

/** A wa.me link for the number, or null when it is blank. */
export function whatsappUrl(number: string = WHATSAPP_NUMBER): string | null {
  const digits = number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
