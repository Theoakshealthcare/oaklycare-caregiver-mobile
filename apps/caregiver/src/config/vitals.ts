/**
 * Whether the Normal / Critical badge on each vital tile (dot, word, tinted background) is drawn. OFF: the app does not
 * rate readings (the backend sends no status and the thresholds need clinician sign-off first). The component is built
 * (`components/vitals/VitalStatusBadge.tsx`) so the Figma look is ready; switch this on only once a clinician-approved
 * status exists to feed it. Never compute a status in the app from a reading.
 */
export const VITAL_STATUS_BADGES = false;
