import { useQuery } from "@tanstack/react-query";

/**
 * A query that answers with sample data. Every screen that is not wired to the backend yet reads its data through
 * a hook built on this, so the screen sees the same `{ data, isLoading, isError, refetch }` a real query gives and the
 * slice that wires it only swaps the `queryFn` (and the key) inside that one hook, never the screen.
 * The cache is cleared on sign-out, which resets the samples too.
 */
export function useFixtureQuery<T>(key: readonly string[], produce: () => T) {
  return useQuery({ queryKey: ["sample", ...key], queryFn: async () => produce(), staleTime: Infinity });
}

/** Keys of the sample caches that mutation hooks edit in place. */
export const sampleKeys = {
  bookings: ["sample", "bookings"] as const,
  chat: (bookingId: string) => ["sample", "chat", bookingId] as const,
  readings: ["sample", "readings"] as const,
  access: ["sample", "access"] as const,
};
