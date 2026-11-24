import type { Schemas } from "@oakly/api-client";

/**
 * The only Paystack channels the backend accepts on `POST /booking/create` (`BookingCreate.channels`, patient bookings FE
 * guide section 14). The Figma "Payment Details" screen also draws "Oakly Wallet": the wallet is not built, so it has no
 * channel here and no row on the screen. The `satisfies` keeps this list in step with the generated API types.
 */
export const PAYMENT_CHANNELS = ["card", "bank_transfer"] as const satisfies readonly NonNullable<Schemas["BookingCreate"]["channels"]>[number][];

export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/** What each row of the screen is called (Figma). The Figma sub-lines are "Lorem ipsum" placeholders: no copy is invented for them. */
export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  card: "Card Payment",
  bank_transfer: "Bank Transfer",
};
