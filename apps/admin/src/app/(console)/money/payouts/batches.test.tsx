import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

import { PayoutBatches } from "./batches";

vi.mock("next/navigation", () => ({ usePathname: () => "/money/payouts" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Capture 185-payout-batches-list.
const BATCH = {
  id: "240f7286-ecd6-4511-ab8a-32a5b75c967e",
  period_key: "2026-10-19",
  cadence: "weekly",
  min_payout_kobo: 500000,
  status: "pending_approval",
  approved_by: null,
  approved_at: null,
  approval_reason: null,
  created_at: "2026-10-12T16:52:06.569281",
  payout_count: 3,
  total_kobo: 5000000,
  counts: { pending_approval: 3 },
};

describe("PayoutBatches", () => {
  it("lists batches with count, total in naira and a link to the detail", async () => {
    stubFetch({ "GET /api/v1/admin/payouts/batches": () => jsonResponse({ items: [BATCH], total: 1 }) });
    render(withAuth(["payments.read"], <PayoutBatches />));
    const row = await screen.findByRole("row", { name: /2026-10-19/ });
    expect(within(row).getByText("₦50,000")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "2026-10-19" })).toHaveAttribute("href", `/money/payouts/batches/${BATCH.id}`);
    expect(within(row).getByText("Pending approval")).toBeInTheDocument();
  });

  it("filters by status through the query string and resets to the first page", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ "GET /api/v1/admin/payouts/batches": () => jsonResponse({ items: [BATCH], total: 1 }) });
    render(withAuth(["payments.read"], <PayoutBatches />));
    await screen.findByRole("row", { name: /2026-10-19/ });
    await user.selectOptions(screen.getByLabelText("Status"), "approved");
    await waitFor(() => expect(calls.some((c) => c.search.includes("status=approved"))).toBe(true));
    expect(calls.at(-1)?.search).toContain("offset=0");
  });

  it("shows an empty state", async () => {
    stubFetch({ "GET /api/v1/admin/payouts/batches": () => jsonResponse({ items: [], total: 0 }) });
    render(withAuth(["payments.read"], <PayoutBatches />));
    expect(await screen.findByText("No payout batches")).toBeInTheDocument();
  });

  it("shows the server's message when loading fails", async () => {
    stubFetch({
      "GET /api/v1/admin/payouts/batches": () =>
        jsonResponse({ detail: "Access denied. Missing permission: payments.read" }, { status: 403 }),
    });
    render(withAuth(["payments.read"], <PayoutBatches />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied. Missing permission: payments.read");
  });
});
