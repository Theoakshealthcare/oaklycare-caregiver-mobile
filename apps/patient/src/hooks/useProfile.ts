import { useMutation } from "@tanstack/react-query";

import type { User } from "@/src/services/auth.service";
import { authService } from "@/src/services/auth.service";

export type ProfileField = "fullName" | "phone" | "address" | "emergencyName" | "emergencyPhone" | "emergencyAddress";

/** The editable fields, the backend key each one is sent under, and where `/auth/me` returns it. */
export const PROFILE_FIELDS: { field: ProfileField; key: string; read: (user: User) => string }[] = [
  { field: "fullName", key: "full_name", read: (u) => u.full_name ?? "" },
  { field: "phone", key: "phone_number", read: (u) => u.phone_number ?? "" },
  { field: "address", key: "address", read: (u) => u.patient?.address ?? "" },
  { field: "emergencyName", key: "emergency_contact_name", read: (u) => u.patient?.emergency_contact_name ?? "" },
  { field: "emergencyPhone", key: "emergency_contact_phone", read: (u) => u.patient?.emergency_contact_phone ?? "" },
  { field: "emergencyAddress", key: "emergency_contact_address", read: (u) => u.patient?.emergency_contact_address ?? "" },
];

export interface UpdateProfileResult {
  user: User;
  /** Fields the server answered 200 for but did not keep (compared with the fresh `/auth/me`). */
  notSaved: ProfileField[];
}

/**
 * Saves the edited fields: `PUT /auth/profile` with only what changed, then re-reads `/auth/me` (so `user.patient` survives).
 * Then compares what was sent with what the server now holds, because the backend answers 200 and silently ignores
 * `full_name` and `phone_number` today; those come back in `notSaved` and the screen says so instead of "updated".
 */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (edited: Partial<Record<ProfileField, string>>): Promise<UpdateProfileResult> => {
      const body: Record<string, string> = {};
      const sent: { field: ProfileField; value: string; read: (u: User) => string }[] = [];
      for (const { field, key, read } of PROFILE_FIELDS) {
        const value = edited[field]?.trim();
        if (value) {
          body[key] = value;
          sent.push({ field, value, read });
        }
      }
      const user = await authService.updateProfile(body);
      return { user, notSaved: sent.filter(({ value, read }) => read(user) !== value).map(({ field }) => field) };
    },
  });
}
