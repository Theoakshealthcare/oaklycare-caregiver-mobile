import type { Metadata } from "next";
import { connection } from "next/server";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Oakly admin", template: "%s · Oakly admin" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request: the CSP nonce (src/proxy.ts) can only be stamped on dynamically rendered pages.
  await connection();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
