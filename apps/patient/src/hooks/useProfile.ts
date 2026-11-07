import { useMutation } from "@tanstack/react-query";

import { ApiError, messageForError } from "@/src/api/errors";
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

/**
 * Saves the edited fields: `PUT /auth/profile` with only the non-blank values the person touched, then re-reads `/auth/me`
 * (the PUT answers a flat profile with no `patient` object, and that re-read is what the screens show). The server saves name
 * and phone now (and removes spaces and dashes from the phone), so a 200 means saved: the saved values come back in `user`.
 * A refusal is a `ProfileRefusal`, read with `profileRefusal`.
 */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (edited: Partial<Record<ProfileField, string>>): Promise<User> => {
      const body: Record<string, string> = {};
      for (const { field, key } of PROFILE_FIELDS) {
        const value = edited[field]?.trim();
        if (value) body[key] = value;
      }
      return authService.updateProfile(body);
    },
  });
}

/** Where to show a refused save: under a field when the server names one, else in a dialog. Always the server's own sentence. */
export interface ProfileRefusal {
  field: ProfileField | null;
  message: string;
}

const FIELD_BY_BACKEND_KEY: Record<string, ProfileField> = { full_name: "fullName", phone_number: "phone" };
const FIELD_BY_CODE: Record<string, ProfileField> = { phone_number_taken: "phone", phone_number_required: "phone" };

/**
 * Reads a failed save. `422` is FastAPI's list: `detail[0].msg` is written for the person and `loc` names the field
 * (`["body", "phone_number"]`). `400` / `409` are `{ detail: { code, message } }`: `phone_number_taken` goes under the phone.
 * Anything else (offline, 5xx, 401) is shown with the shared wording.
 */
export function profileRefusal(error: unknown): ProfileRefusal {
  if (error instanceof ApiError) {
    const detail = (error.body as { detail?: unknown } | null)?.detail;
    if (error.status === 422 && Array.isArray(detail)) {
      const first = detail[0] as { loc?: unknown[]; msg?: unknown } | undefined;
      const key = Array.isArray(first?.loc) ? String(first?.loc.at(-1)) : "";
      if (typeof first?.msg === "string") return { field: FIELD_BY_BACKEND_KEY[key] ?? null, message: first.msg };
    }
    if (error.code && detail && typeof detail === "object" && !Array.isArray(detail)) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") return { field: FIELD_BY_CODE[error.code] ?? null, message };
    }
  }
  return { field: null, message: messageForError(error) };
}
