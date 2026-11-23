export const queryKeys = {
  me: ["me"] as const,
  bookings: ["bookings"] as const,
  booking: (id: string) => ["bookings", "detail", id] as const,
  cancelTerms: (id: string) => ["bookings", "cancel-terms", id] as const,
  tracking: (id: string) => ["bookings", "tracking", id] as const,
  chat: (id: string) => ["bookings", "chat", id] as const,
  services: ["booking-services"] as const,
  quote: (service: string, minutes: number, latitude: number | null, longitude: number | null) => ["quote", service, minutes, latitude, longitude] as const,
};
