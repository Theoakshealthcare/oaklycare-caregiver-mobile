/**
 * GET /caregiver/home turned into what the home screen shows. Pure: no hardcoded values, every
 * field comes from the response (backend guide, section 9).
 */
import type { Schemas } from "@oakly/api-client";

import { homeOfferToOffer, type Offer } from "@/src/services/booking.service";
import { formatDuration, formatVisitTime, parseBackendDate } from "@/src/utils/dates";

type Home = Schemas["CaregiverHome"];
type HomeVisit = Schemas["HomeVisit"];

/** Matching only considers caregivers whose last location is at most 15 minutes old (guide, section 5). */
export const LOCATION_FRESHNESS_MS = 15 * 60_000;

export const HOME_POLL_ACTIVE_MS = 20_000;
export const HOME_POLL_IDLE_MS = 60_000;

/** Guide section 13: poll every 15 to 30 s while available; slower when there is nothing to wait for. */
export function homePollInterval(home: Home | undefined): number {
  if (!home) return HOME_POLL_ACTIVE_MS;
  const onAVisit = [...home.today_visits, ...home.upcoming_visits].some((v) => v.status === "en_route" || v.status === "in_progress");
  return home.is_available || onAVisit ? HOME_POLL_ACTIVE_MS : HOME_POLL_IDLE_MS;
}

/** "You are not receiving offers: your location is out of date" (guide, section 14.1). */
export function isLocationStale(home: Pick<Home, "is_available" | "location_updated_at">, now: number): boolean {
  if (!home.is_available) return false;
  if (!home.location_updated_at) return true;
  return now - parseBackendDate(home.location_updated_at).getTime() > LOCATION_FRESHNESS_MS;
}

/**
 * After a location ping lands, is the home we hold still showing the old "location out of date"
 * warning? Then it must be refetched, or the warning stays until the caregiver pulls to refresh (DP1-14).
 */
export function shouldRefetchHomeAfterPing(cached: Pick<Home, "is_available" | "location_updated_at"> | undefined, now: number): boolean {
  return !cached || isLocationStale(cached, now);
}

export function formatNaira(amount: number): string {
  const [whole, fraction] = Math.abs(amount).toFixed(2).split(".");
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0 ? "-" : ""}₦${grouped}.${fraction}`;
}

/** "Ada Obi" -> "Ada". Falls back to null so the greeting can drop the name rather than invent one. */
export function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export function greeting(fullName: string | null | undefined): string {
  const name = firstName(fullName);
  return name ? `Hello ${name}` : "Hello";
}

export type VisitStep = "accepted" | "en_route" | "in_progress";

export interface VisitView {
  id: string;
  title: string;
  patientName: string;
  address: string;
  when: string;
  duration: string;
  status: string;
  statusLabel: string;
  /** Visits that already left (en_route) or started are the ones to resume first. */
  inFlight: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  en_route: "On the way",
  in_progress: "In progress",
};

export function toVisitView(visit: HomeVisit): VisitView {
  return {
    id: visit.id,
    title: `${visit.service_type} visit`,
    patientName: visit.patient_name ?? "Patient",
    address: [visit.patient_address, visit.patient_city].filter(Boolean).join(", "),
    when: formatVisitTime(visit.scheduled_date),
    duration: formatDuration(visit.duration_hours),
    status: visit.status,
    statusLabel: STATUS_LABEL[visit.status] ?? visit.status.replace("_", " "),
    inFlight: visit.status === "en_route" || visit.status === "in_progress",
  };
}

export interface HomeView {
  profileStatus: string;
  /** Only approved caregivers may switch availability or accept offers. */
  approved: boolean;
  isAvailable: boolean;
  locationStale: boolean;
  todayVisits: VisitView[];
  upcomingVisits: VisitView[];
  /** Offer view only: no patient fields exist on the type. */
  offers: Offer[];
  walletBalance: string;
  /** Server-computed (the nurse skill is not in any response); shows the Care plans card. */
  canAuthorCarePlans: boolean;
}

export function mapHome(home: Home, now: number): HomeView {
  return {
    profileStatus: home.profile_status,
    approved: home.profile_status === "approved",
    isAvailable: home.is_available,
    locationStale: isLocationStale(home, now),
    todayVisits: home.today_visits.map(toVisitView),
    upcomingVisits: home.upcoming_visits.map(toVisitView),
    offers: home.open_offers.map(homeOfferToOffer),
    walletBalance: formatNaira(home.wallet_balance_naira),
    canAuthorCarePlans: home.can_author_care_plans === true,
  };
}
