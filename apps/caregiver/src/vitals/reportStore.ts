/**
 * The downloaded vitals report, held in memory only between the Vitals tab (which downloads it) and the "Vital Report
 * Downloaded Successfully" page (which shares it). Vitals are health data: it is never put in a route param, storage or a log,
 * and the page drops it when it closes. It is tagged with the patient it belongs to, so one patient's report can never be
 * shared from another's screen.
 */
let held: { patientId: string; csv: string } | null = null;

export function holdReport(patientId: string, csv: string): void {
  held = { patientId, csv };
}

export function heldReport(patientId: string): string | null {
  return held && held.patientId === patientId ? held.csv : null;
}

export function dropReport(): void {
  held = null;
}
