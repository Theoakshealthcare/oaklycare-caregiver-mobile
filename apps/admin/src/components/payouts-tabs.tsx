"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/money/payouts", label: "Batches" },
  { href: "/money/payouts/all", label: "All payouts" },
  { href: "/money/payouts/attention", label: "Needs attention" },
];

export function PayoutsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Payouts" className="flex gap-1 border-b">
      {TABS.map((t) => {
        // Batch detail pages live under /money/payouts/batches and belong to the Batches tab.
        const active =
          t.href === "/money/payouts" ? pathname === t.href || pathname.startsWith("/money/payouts/batches") : pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", active ? "border-foreground font-medium" : "border-transparent text-muted-foreground")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
