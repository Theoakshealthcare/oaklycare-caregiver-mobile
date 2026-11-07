import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import { authService } from "@/src/services/auth.service";

export function useMe() {
  const enabled = useSession((s) => s.status === "signedIn");
  return useQuery({ queryKey: queryKeys.me, queryFn: authService.getMe, enabled });
}
