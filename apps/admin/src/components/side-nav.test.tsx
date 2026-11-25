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
    expect(labels).not.toContain("Audit");
    // ...but the information architecture still has them for later.
    const all = visibleNav(SUPER, true).flatMap((g) => g.items.map((i) => i.label));
    expect(all).toContain("Audit");
  });

  it("keeps the PRD group order", () => {
    const groups = visibleNav([...SUPER, "payments.read", "support.inbox"], true).map((g) => g.label);
    expect(groups).toEqual(["Overview", "Queues", "Bookings", "Money", "Admin"]);
  });

  it("shows Payouts to a reader (payments.read), not by payouts.execute", () => {
    render(<SideNav permissions={["payments.read"]} pathname="/money/payouts" />);
    expect(screen.getByRole("link", { name: "Payouts" })).toHaveAttribute("aria-current", "page");
  });

  it("hides Payouts from an admin without payments.read", () => {
    render(<SideNav permissions={["payouts.execute", "caregivers.read"]} pathname="/" />);
    expect(screen.queryByRole("link", { name: "Payouts" })).not.toBeInTheDocument();
  });

  it("shows an Operations admin both Bookings and Unmatched", () => {
    render(<SideNav permissions={["bookings.read", "bookings.dispatch", "bookings.assign", "bookings.address"]} pathname="/bookings" />);
    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Unmatched" })).toHaveAttribute("href", "/queues/unmatched");
  });

  it("shows a Finance admin with only bookings.read Bookings but not Unmatched", () => {
    render(<SideNav permissions={["bookings.read", "payments.read"]} pathname="/" />);
    expect(screen.getByRole("link", { name: "Bookings" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unmatched" })).not.toBeInTheDocument();
  });

  it("shows Refunds to anyone who may read them, and to no one else", () => {
    for (const permission of ["refunds.request", "refunds.approve", "payments.read"]) {
      const labels = visibleNav([permission]).flatMap((g) => g.items.map((i) => i.label));
      expect(labels).toContain("Refunds");
    }
    const labels = visibleNav(["dashboard.read", "caregivers.read", "clinical.read"]).flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("Refunds");
  });
  it("shows Earnings under Money to anyone who can read payments, and to no one else", () => {
    expect(visibleNav(["payments.read"]).flatMap((g) => g.items.map((i) => i.label))).toContain("Earnings");
    expect(visibleNav(["ledger.adjust_request", "payouts.execute"]).flatMap((g) => g.items.map((i) => i.label))).not.toContain("Earnings");
    render(<SideNav permissions={["payments.read"]} pathname="/money/earnings" />);
    expect(screen.getByRole("link", { name: "Earnings" })).toHaveAttribute("aria-current", "page");
  });

  it("shows a count badge on the Earnings item, with a spoken label, and none for zero or no data", () => {
    const badges = { "/money/earnings": { count: 3, label: "held for review" } };
    const { rerender } = render(<SideNav permissions={["payments.read"]} pathname="/" badges={badges} />);
    const link = screen.getByRole("link", { name: "Earnings 3 held for review" });
    expect(link).toHaveAttribute("href", "/money/earnings");
    rerender(<SideNav permissions={["payments.read"]} pathname="/" badges={{ "/money/earnings": { count: 120, label: "held for review" } }} />);
    expect(screen.getByRole("link", { name: "Earnings 120 held for review" })).toHaveTextContent("99+");
    rerender(<SideNav permissions={["payments.read"]} pathname="/" badges={{ "/money/earnings": { count: 0, label: "held for review" } }} />);
    expect(screen.getByRole("link", { name: "Earnings" })).toBeInTheDocument();
    rerender(<SideNav permissions={["payments.read"]} pathname="/" />);
    expect(screen.getByRole("link", { name: "Earnings" })).toBeInTheDocument();
  });
});
