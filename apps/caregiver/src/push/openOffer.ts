import { homeOfferToOffer, type Offer } from "@/src/services/booking.service";
import type { CaregiverHome } from "@/src/supply/locationService";

/**
 * Finds the offer a push points at. An un-accepted booking answers 403 on GET /booking/booking/{id},
 * so the offer view comes from `open_offers` in the home summary (guide, section 6). Null when the
 * offer is gone (taken, expired, declined) or home cannot be loaded.
 */
export async function resolveOffer(bookingId: string, loadHome: () => Promise<CaregiverHome>): Promise<Offer | null> {
  let home: CaregiverHome;
  try {
    home = await loadHome();
  } catch {
    return null;
  }
  const offer = home.open_offers.find((o) => o.booking_id === bookingId);
  return offer ? homeOfferToOffer(offer) : null;
}
