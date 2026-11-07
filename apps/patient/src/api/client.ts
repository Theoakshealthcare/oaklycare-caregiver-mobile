import { createOaklyClient } from "@oakly/api-client";

import { session } from "@/src/auth";

import { API_BASE_URL } from "./config";

/** The one typed client every service uses. Bearer token and one refresh-and-retry on 401. */
export const api = createOaklyClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => session.getAccessToken(),
  onUnauthorized: () => session.refresh(),
});
