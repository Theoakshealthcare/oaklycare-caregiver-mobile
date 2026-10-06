import type { NextConfig } from "next";

const config: NextConfig = {
  // @oakly/api-client ships TypeScript source.
  transpilePackages: ["@oakly/api-client"],
  poweredByHeader: false,
  // Don't let `next dev` write AGENTS.md / CLAUDE.md into the repo.
  agentRules: false,
  // Dev only: lets the Playwright e2e and local browsers reach the dev server as 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          // Production only: HSTS on plain-http localhost would be ignored anyway, but keep dev clean.
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default config;
