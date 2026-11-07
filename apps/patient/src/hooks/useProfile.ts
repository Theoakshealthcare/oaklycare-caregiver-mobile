import { useMutation } from "@tanstack/react-query";

/** Saves the edited profile fields. Sample: nothing is sent; the profile slice calls `PUT /auth/profile` and then re-reads `/auth/me`. */
export function useUpdateProfile() {
  return useMutation({ mutationFn: async (_fields: Record<string, string | undefined>) => undefined });
}
