const BASE = "http://internal.invalid";

/**
 * Only same-origin paths are accepted as a post-login destination (no open redirect).
 * Browsers strip tab, CR and LF from URLs, so `/\t/evil.com` would become `//evil.com`;
 * control characters and whitespace are therefore removed before any check, and the
 * normalised path is checked again after parsing.
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
  // Validate the NORMALISED path, not the input: dot segments can collapse into a
  // protocol-relative path ("/.//evil.com" -> "//evil.com"). Collapse any run of leading
  // slashes/backslashes to a single "/" so the result can only ever be same-origin.
  const pathname = "/" + url.pathname.replace(/^[/\\]+/, "");
  if (pathname.startsWith("/login") || pathname.startsWith("/api/")) return "/";
  return pathname + url.search + url.hash;
}
