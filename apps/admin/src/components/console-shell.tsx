"use client";

import { LogOut, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { IdleWarning } from "@/components/idle-warning";
import { SideNav } from "@/components/side-nav";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { humanize } from "@/lib/format";

/** Auth gate plus the app frame. Children render only for a signed-in admin. */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { status, admin, signOut, retryBoot } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status === "unreachable") {
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState message="We couldn't reach Oakly to restore your session. Check your connection." onRetry={retryBoot} />
      </div>
    );
  }
  if (status !== "authenticated" || !admin) {
    return (
      <div className="grid min-h-screen grid-cols-[16rem_1fr]" aria-busy="true" aria-label="Loading">
        <Skeleton className="hidden h-full rounded-none lg:block" />
        <div className="grid content-start gap-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r bg-sidebar p-4 lg:block">
        <div className="mb-6 px-2 text-base font-semibold">Oakly admin</div>
        <SideNav permissions={admin.permissions} pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Menu />
          </Button>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium">{admin.full_name}</div>
              <div className="text-xs text-muted-foreground">{admin.roles.map(humanize).join(", ")}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut aria-hidden />
              Sign out
            </Button>
          </div>
        </header>
        {menuOpen ? (
          <div className="border-b bg-sidebar p-4 lg:hidden">
            <SideNav permissions={admin.permissions} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </div>
        ) : null}
        <main id="main" className="min-w-0 flex-1 p-6">
          {children}
        </main>
      </div>
      <IdleWarning />
    </div>
  );
}
