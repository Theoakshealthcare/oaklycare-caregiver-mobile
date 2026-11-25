import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import { visitDocumentationService } from "@/src/services/visitDocumentation.service";

/** Own documentation is health text: in memory only, with a short `gcTime`, cleared on sign-out. */
const GC_TIME = 2 * 60_000;

export function useVisitDocumentation(bookingId: string) {
  const signedIn = useSession((s) => s.status === "signedIn");
  return useQuery({
    queryKey: queryKeys.visitDocumentation(bookingId),
    queryFn: () => visitDocumentationService.list(bookingId),
    enabled: signedIn,
    gcTime: GC_TIME,
  });
}

export function useAddVisitDocumentation(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => visitDocumentationService.add(bookingId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.visitDocumentation(bookingId) }),
  });
}
