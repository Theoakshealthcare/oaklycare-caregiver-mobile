/**
 * Content-Security-Policy for every response. Scripts are limited to this origin plus a per-request
 * nonce (Next stamps it on its own inline bootstrap scripts); `strict-dynamic` lets those trusted
 * scripts load their chunks. `'unsafe-eval'` is dev-only (React debug stacks). Styles keep
 * `'unsafe-inline'` because Radix/Tailwind set inline style attributes, which a nonce cannot cover.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
