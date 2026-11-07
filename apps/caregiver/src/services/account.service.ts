import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { appendPickedFile } from "@/src/api/filePart";
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
  appendPickedFile(form, "file", { uri: image.uri, name: image.fileName ?? "profile.jpg", type: image.mimeType ?? "image/jpeg" });
  return form;
}

export const accountService = {
  /** The backend ignores empty values, so only send what the caregiver actually filled in. */
  updateProfile(data: ProfileUpdate) {
    return unwrap(api.PUT("/api/v1/auth/profile", { body: data }));
  },

  /** Multipart (plain fetch); Content-Type is left to fetch so the boundary is added. Answers `{ profile_image_url }`. */
  async uploadProfileImage(image: PickedImage): Promise<string | null> {
    // Plain-fetch multipart path (openapi-fetch's Request wrapper cannot carry a FormData file part).
    const raw: unknown = await unwrap(api.uploadMultipart("/api/v1/auth/profile/upload-image", buildImageForm(image)));
    const url = raw && typeof raw === "object" ? (raw as { profile_image_url?: unknown }).profile_image_url : undefined;
    return typeof url === "string" ? url : null;
  },
};
