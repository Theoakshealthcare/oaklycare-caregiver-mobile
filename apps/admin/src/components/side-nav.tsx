import Link from "next/link";

import { visibleNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Grouped left navigation. Items the permissions don't cover are not rendered at all (PRD section 9). */
export function SideNav({
  permissions,
  pathname,
  onNavigate,
}: {
  permissions: readonly string[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups = visibleNav(permissions);
  return (
    <nav aria-label="Main" className="grid gap-5 text-sm">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center rounded-md px-2 hover:bg-muted",
                      active && "bg-muted font-medium",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
