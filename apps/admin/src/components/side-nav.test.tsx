import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SideNav } from "@/components/side-nav";
import { visibleNav } from "@/lib/nav";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const VERIFICATION = ["dashboard.read", "caregivers.read", "caregivers.approve", "documents.read"];
const SUPER = [...VERIFICATION, "caregivers.suspend", "admins.manage", "audit.read", "bookings.read"];

describe("permission-gated navigation", () => {
  it("shows a Verification admin the queue but not the Admin group", () => {
    render(<SideNav permissions={VERIFICATION} pathname="/" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(within(nav).queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows a Super Admin the Admin group", () => {
    render(<SideNav permissions={SUPER} pathname="/admin/users" />);
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("aria-current", "page");
  });

  it("hides every item for an admin with no permissions, rather than rendering disabled links", () => {
    render(<SideNav permissions={[]} pathname="/" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("does not list modules that aren't built yet, even when permitted", () => {
    const labels = visibleNav(SUPER).flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("Bookings");
    expect(labels).not.toContain("Audit");
    // ...but the information architecture still has them for later.
    const all = visibleNav(SUPER, true).flatMap((g) => g.items.map((i) => i.label));
    expect(all).toContain("Bookings");
    expect(all).toContain("Audit");
  });

  it("keeps the PRD group order", () => {
    const groups = visibleNav([...SUPER, "payments.read", "support.inbox"], true).map((g) => g.label);
    expect(groups).toEqual(["Overview", "Queues", "Bookings", "Money", "Admin"]);
  });
});
