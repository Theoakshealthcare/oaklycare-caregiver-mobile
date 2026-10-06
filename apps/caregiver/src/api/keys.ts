export const queryKeys = {
  me: ["me"] as const,
  home: ["home"] as const,
  verificationStatus: ["verification-status"] as const,
  formOptions: ["form-options"] as const,
  bookings: (filter: string) => ["bookings", filter] as const,
  allBookings: ["bookings"] as const,
  booking: (id: string) => ["booking", id] as const,
  chat: (bookingId: string) => ["chat", bookingId] as const,
  notes: (bookingId: string) => ["notes", bookingId] as const,
};
