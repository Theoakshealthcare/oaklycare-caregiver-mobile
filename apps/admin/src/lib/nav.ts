/**
 * Left navigation, grouped as in PRD section 9. Only modules that exist in the console are
 * `available`; the rest document the information architecture and are filtered out until built.
 * An item is shown only when the admin holds every listed permission (PRD section 8.2).
 */
export interface NavItem {
  label: string;
  href: string;
  /** Any one of these grants visibility. Empty means every signed-in admin. */
  anyOf: string[];
  available: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Overview", href: "/", anyOf: ["dashboard.read"], available: true }],
  },
  {
    label: "Queues",
    items: [
      { label: "Applications", href: "/caregivers/applications", anyOf: ["caregivers.read"], available: true },
      {
        label: "Unmatched",
        href: "/queues/unmatched",
        anyOf: ["bookings.dispatch", "bookings.assign", "bookings.address"],
        available: true,
      },
      { label: "Refunds", href: "/queues/refunds", anyOf: ["refunds.approve", "refunds.request"], available: false },
      { label: "Support", href: "/queues/support", anyOf: ["support.inbox"], available: false },
      { label: "Exceptions", href: "/queues/exceptions", anyOf: ["payments.read"], available: false },
    ],
  },
  {
    label: "Bookings",
    items: [{ label: "Bookings", href: "/bookings", anyOf: ["bookings.read"], available: true }],
  },
  {
    label: "People",
    items: [{ label: "Patients and contacts", href: "/people", anyOf: ["people.read"], available: false }],
  },
  {
    label: "Money",
    items: [
      { label: "Payments", href: "/money/payments", anyOf: ["payments.read"], available: false },
      { label: "Payouts", href: "/money/payouts", anyOf: ["payments.read"], available: true },
      { label: "Reconciliation", href: "/money/reconciliation", anyOf: ["payments.reconcile"], available: false },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Pricing", href: "/content/pricing", anyOf: ["pricing.write"], available: false },
      { label: "FallGuard", href: "/content/fallguard", anyOf: ["fallguard.write"], available: false },
      { label: "Service areas", href: "/content/service-areas", anyOf: ["settings.write"], available: false },
    ],
  },
  {
    label: "WhatsApp",
    items: [{ label: "WhatsApp", href: "/whatsapp", anyOf: ["whatsapp.read"], available: false }],
  },
  {
    label: "Admin",
    items: [
      { label: "Users", href: "/admin/users", anyOf: ["admins.manage"], available: true },
      { label: "Audit", href: "/admin/audit", anyOf: ["audit.read"], available: false },
    ],
  },
];

export function hasPermission(permissions: readonly string[], required: string): boolean {
  return permissions.includes(required);
}

/** The nav the admin may see: available items they have permission for, with empty groups dropped. */
export function visibleNav(permissions: readonly string[], includeUnavailable = false): NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (includeUnavailable || item.available) &&
        (item.anyOf.length === 0 || item.anyOf.some((p) => permissions.includes(p))),
    ),
  })).filter((group) => group.items.length > 0);
}
