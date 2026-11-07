/** Server origin only (no /api/v1): the generated client's paths already start with /api/v1. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
