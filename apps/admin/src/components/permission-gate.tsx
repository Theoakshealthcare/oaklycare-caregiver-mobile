"use client";

import { ShieldAlert } from "lucide-react";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";

/** Page-level guard: a direct URL to a module the role can't reach shows this instead of a 403 from the API. */
export function RequirePermission({ anyOf, children }: { anyOf: string[]; children: React.ReactNode }) {
  const { admin } = useAuth();
  const allowed = anyOf.some((p) => admin?.permissions.includes(p));
  if (!allowed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">You don&apos;t have access to this page</p>
        <p className="text-sm text-muted-foreground">Ask a Super Admin to add the role that covers it.</p>
      </div>
    );
  }
  return <>{children}</>;
}
