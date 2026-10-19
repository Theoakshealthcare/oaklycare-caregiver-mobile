import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MASKED_PATIENT, makeUnmatched } from "@/test/booking-fixtures";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

import { UnmatchedQueue } from "./unmatched-queue";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PATH = "GET /api/v1/admin/bookings/unmatched";
const OPS = ["bookings.read", "bookings.dispatch"];
const U = makeUnmatched();
const AC = makeUnmatched({
  id: "22222222-2222-4222-8222-222222222222",
  booking_code: "ADDR0001",
  queue_reason: "address_check",
  waiting_minutes: 30,
  needs_address_check: true,
  patient: MASKED_PATIENT,
});
const SLA = makeUnmatched({
  id: "33333333-3333-4333-8333-333333333333",
  booking_code: "SLA00001",
  queue_reason: "sla_breached",
  waiting_minutes: 2900,
});

describe("UnmatchedQueue", () => {
  it("lists rows in server order with reason, explanation, waiting time and links", async () => {
    const calls = stubFetch({ [PATH]: () => jsonResponse({ items: [AC, U, SLA], total: 3 }) });
    render(withAuth(OPS, <UnmatchedQueue />));
    expect(screen.getByText(/Paid bookings still waiting for a caregiver, soonest visit first/)).toBeInTheDocument();
    const rowAc = await screen.findByRole("row", { name: /ADDR0001/ });
    expect(calls[0]?.search).toBe("?limit=25&offset=0");
    expect(rowAc).toHaveTextContent("Address check");
    expect(rowAc).toHaveTextContent("Paid but held: the map pin is a city-centre placeholder. Dispatch has not started.");
    expect(rowAc).toHaveTextContent("30 min");
    expect(within(rowAc).getByText("masked")).toBeInTheDocument();
    expect(within(rowAc).getByRole("link", { name: "Open" })).toHaveAttribute("href", `/bookings/${AC.id}`);
    expect(within(rowAc).getByRole("link", { name: "ADDR0001" })).toHaveAttribute("href", `/bookings/${AC.id}`);
    const rowU = screen.getByRole("row", { name: /12FF3CB2/ });
    expect(rowU).toHaveTextContent("Dispatch found no one.");
    expect(rowU).toHaveTextContent("1 h");
    expect(rowU).toHaveTextContent("₦55,000");
    expect(screen.getByRole("row", { name: /SLA00001/ })).toHaveTextContent("Still dispatching past the 30-minute target.");
    expect(screen.getByRole("row", { name: /SLA00001/ })).toHaveTextContent("2 d");
    const rows = screen.getAllByRole("row").map((r) => r.textContent ?? "");
    expect(rows[1]).toContain("ADDR0001");
    expect(rows[2]).toContain("12FF3CB2");
  });

  it("filters by reason and resets paging", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [PATH]: () => jsonResponse({ items: [U], total: 60 }) });
    render(withAuth(OPS, <UnmatchedQueue />));
    await screen.findByRole("row", { name: /12FF3CB2/ });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(calls.at(-1)?.search).toContain("offset=25"));
    await user.selectOptions(screen.getByLabelText("Reason"), "sla_breached");
    await waitFor(() => expect(calls.at(-1)?.search).toContain("reason=sla_breached"));
    expect(calls.at(-1)?.search).toContain("offset=0");
  });

  it("shows the empty state", async () => {
    stubFetch({ [PATH]: () => jsonResponse({ items: [], total: 0 }) });
    render(withAuth(OPS, <UnmatchedQueue />));
    expect(await screen.findByText("Nothing is waiting")).toBeInTheDocument();
    expect(screen.getByText("Every paid booking has a caregiver or is still within its first 30 minutes of dispatch.")).toBeInTheDocument();
  });

  it("shows the server's error", async () => {
    stubFetch({ [PATH]: () => jsonResponse({ detail: "Access denied. Missing permission: bookings.read" }, { status: 403 }) });
    render(withAuth(OPS, <UnmatchedQueue />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied. Missing permission: bookings.read");
  });
});
