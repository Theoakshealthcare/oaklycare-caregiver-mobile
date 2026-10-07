import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type ProfileUpdate = Schemas["UserProfileUpdate"];
export type ProfileResponse = Schemas["UserProfileResponse"];

/** A picked photo as expo-image-picker reports it. */
export interface PickedImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export function buildImageForm(image: PickedImage): FormData {
  const form = new FormData();
  // React Native serialises this descriptor object as the file part; it is not a web Blob.
  const part = { uri: image.uri, name: image.fileName ?? "profile.jpg", type: image.mimeType ?? "image/jpeg" };
  form.append("file", part as unknown as Blob);
  return form;
}

export const accountService = {
  /** The backend ignores empty values, so only send what the caregiver actually filled in. */
  updateProfile(data: ProfileUpdate) {
    return unwrap(api.PUT("/api/v1/auth/profile", { body: data }));
  },

  /** Multipart; Content-Type is left to fetch so the boundary is added. Answers `{ profile_image_url }`. */
  async uploadProfileImage(image: PickedImage): Promise<string | null> {
    const raw: unknown = await unwrap(
      api.POST("/api/v1/auth/profile/upload-image", {
        // The generated type describes the file field as a string; the real body is built below.
        body: { file: "" },
        bodySerializer: () => buildImageForm(image),
      }),
    );
    const url = raw && typeof raw === "object" ? (raw as { profile_image_url?: unknown }).profile_image_url : undefined;
    return typeof url === "string" ? url : null;
  },
};
