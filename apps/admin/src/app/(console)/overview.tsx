"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

/** Placeholder until the bookings and money packages (A2/A3) add dashboard data. */
export function OverviewPlaceholder() {
  const { admin, can } = useAuth();
  const first = admin?.full_name.split(" ")[0] ?? "";
  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome{first ? `, ${first}` : ""}</h1>
        <p className="text-sm text-muted-foreground">
          Dashboard figures arrive with the bookings and money modules. Until then, start from a queue.
        </p>
      </div>
      {can("caregivers.read") ? (
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-medium">Caregiver applications</h2>
            <p className="text-sm text-muted-foreground">Review documents, checks and skills, then approve.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/caregivers/applications">
              Open queue <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
