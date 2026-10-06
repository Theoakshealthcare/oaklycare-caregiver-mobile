const BASE = "http://internal.invalid";

/**
 * Only same-origin paths are accepted as a post-login destination (no open redirect).
 * Browsers strip tab, CR and LF from URLs, so `/\t/evil.com` would become `//evil.com`;
 * control characters and whitespace are therefore removed before any check.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  const cleaned = value.replace(/[\u0000-\u001F\u007F\s]/g, "");
  if (!cleaned.startsWith("/") || cleaned.startsWith("//") || cleaned.startsWith("/\\")) return "/";
  let url: URL;
  try {
    url = new URL(cleaned, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";
  if (url.pathname.startsWith("/login") || url.pathname.startsWith("/api/")) return "/";
  return url.pathname + url.search + url.hash;
}
