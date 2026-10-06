import { describe, expect, it } from "vitest";

import { buildCsp } from "./csp";

describe("buildCsp", () => {
  const prod = buildCsp("abc123", false);

  it("locks the document down", () => {
    for (const d of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "connect-src 'self'", "frame-src blob:", "img-src 'self' blob: data:"]) {
      expect(prod).toContain(d);
    }
  });

  it("allows scripts only from self and the request nonce, never eval or inline in production", () => {
    const script = prod.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(script).toContain("'nonce-abc123'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it("permits eval only in development", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });
});
