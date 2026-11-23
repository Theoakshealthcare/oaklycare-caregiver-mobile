import type { BookableService } from "@/src/domain/booking";

/**
 * The lists behind the booking form's dropdowns (Figma draws them as selects). The backend takes every one of these as
 * free text (`booking_for`, `assistance_type`, `condition`, `patient_state`, preferences inside the special instructions),
 * so these lists are the app's own wording, not a server catalogue. Only the service and its length come from the server
 * (`GET /booking/services`).
 */
export interface Choice {
  value: string;
  label: string;
}

const same = (labels: string[]): Choice[] => labels.map((label) => ({ value: label, label }));

/** "Who are you Booking for ?" The chosen label is what the backend stores in `booking_for`. */
export const RELATIONS = same(["Myself", "My Mother", "My Father", "My Husband", "My Wife", "My Son", "My Daughter", "Someone else"]);

/** The value that opens a typed answer under the dropdown. */
export const OTHER = "Other";

/** "What Assistance Do You Need?" */
export const ASSISTANCE = same(["Walking assistance", "Wound dressing", "Personal care", "Medication assistance", "Post-surgery care", "Elderly care", OTHER]);

/** "Do You Have Any Common Conditions?" (optional) */
export const CONDITIONS = same(["None", "Hypertension", "Diabetes", "Arthritis", "Stroke recovery", "Dementia", "Heart condition", OTHER]);

/** The 36 states and the Federal Capital Territory (the same list the caregiver app falls back to). */
export const STATES = same([
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "Federal Capital Territory", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun",
  "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
]);

/** "any" means no preference and is not sent. */
export const LANGUAGES: Choice[] = [{ value: "any", label: "No preference" }, ...same(["English", "Yoruba", "Igbo", "Hausa", "Pidgin"])];
export const GENDERS: Choice[] = [{ value: "any", label: "No preference" }, { value: "female", label: "Female" }, { value: "male", label: "Male" }];

/** The services this app sells. The catalogue may list more (a doctor, a physio); their flows are not in the patient app, so they are not offered. */
export const OFFERED_SERVICES = ["nurse"];

export const offeredServices = (all: BookableService[]): BookableService[] => all.filter((s) => OFFERED_SERVICES.includes(s.serviceType));

/** "1 hour", "1 hour 30 minutes", "30 minutes". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 0 ? "" : `${h} ${h === 1 ? "hour" : "hours"}`;
  const mins = m === 0 ? "" : `${m} ${m === 1 ? "minute" : "minutes"}`;
  return [hours, mins].filter(Boolean).join(" ");
}

/** Every length the service allows: `min`, `min + step`, ... up to `max` (read from the server, never hard-coded). */
export function durationChoices(service: Pick<BookableService, "minMinutes" | "stepMinutes" | "maxMinutes">): Choice[] {
  const out: Choice[] = [];
  for (let m = service.minMinutes; m <= service.maxMinutes && service.stepMinutes > 0; m += service.stepMinutes) out.push({ value: String(m), label: durationLabel(m) });
  return out;
}
