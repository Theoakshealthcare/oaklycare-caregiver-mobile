import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MASKED_PATIENT, makeListItem } from "@/test/booking-fixtures";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

import { BookingsList } from "./bookings-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/bookings";
const OPS = ["bookings.read", "people.pii"];
const FINANCE = ["bookings.read"];
const A = makeListItem();
const B = makeListItem({
  id: "11111111-1111-4111-8111-111111111111",
  booking_code: "ZZZ99999",
  patient: MASKED_PATIENT,
  caregiver: { id: "c1", full_name: "Placeholder Nurse", phone: "+2340000000000" } as never,
  status: "accepted",
  payment_status: "paid",
  channel: "whatsapp",
  total_amount_kobo: 6000000,
  age_minutes: 180,
  needs_address_check: true,
  refund_required: true,
  no_show_flagged_at: "2026-10-10T09:00:00",
  no_show_suspected: true,
});

function list(items: ReturnType<typeof makeListItem>[], total = items.length) {
  return () => jsonResponse({ items, total });
}

describe("BookingsList", () => {
  it("renders rows with link, patient, status, total, channel, age and flags", async () => {
    stubFetch({ [LIST]: list([A, B]) });
    render(withAuth(OPS, <BookingsList />));
    const rowA = await screen.findByRole("row", { name: /DDDE4418/ });
    expect(within(rowA).getByRole("link", { name: "DDDE4418" })).toHaveAttribute("href", `/bookings/${A.id}`);
    expect(rowA).toHaveTextContent("Chidi Eze");
    expect(rowA).toHaveTextContent("+2340000302013");
    expect(rowA).toHaveTextContent("₦55,000");
    expect(rowA).toHaveTextContent("40 min");
    expect(rowA).toHaveTextContent("App");
    expect(within(rowA).queryByText("masked")).not.toBeInTheDocument();

    const rowB = await screen.findByRole("row", { name: /ZZZ99999/ });
    expect(rowB).toHaveTextContent("Chidi E.");
    expect(within(rowB).getByText("masked")).toBeInTheDocument();
    expect(rowB).toHaveTextContent("WhatsApp");
    expect(rowB).toHaveTextContent("3 h");
    expect(rowB).toHaveTextContent("Address check");
    expect(rowB).toHaveTextContent("Refund requested");
    expect(rowB).toHaveTextContent("No-show flagged");
    expect(rowB).toHaveTextContent("Possible no-show");
    expect(within(rowA).queryByText("Address check")).not.toBeInTheDocument();
  });

  it("sends the exact query for a combination of filters", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: list([A]) });
    render(withAuth(OPS, <BookingsList />));
    await screen.findByRole("row", { name: /DDDE4418/ });
    expect(calls[0]?.search).toBe("?limit=25&offset=0");

    await user.selectOptions(screen.getByLabelText("Status"), "accepted");
    await user.selectOptions(screen.getByLabelText("Payment"), "paid");
    await user.selectOptions(screen.getByLabelText("Dispatch"), "unmatched");
    await user.selectOptions(screen.getByLabelText("Channel"), "whatsapp");
    await user.type(screen.getByLabelText("Search"), "DDDE");
    await user.type(screen.getByLabelText("City"), "Lagos");
    await user.type(screen.getByLabelText("Scheduled from"), "2026-10-10");
    await user.type(screen.getByLabelText("Scheduled to"), "2026-10-11");
    await user.click(screen.getByLabelText("Needs address check"));
    await user.click(screen.getByLabelText(/No-show \(flagged or suspected\)/));
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(calls.at(-1)?.search).toContain("q=DDDE"));
    const params = new URLSearchParams(calls.at(-1)?.search);
    expect(Object.fromEntries(params)).toEqual({
      limit: "25",
      offset: "0",
      q: "DDDE",
      status: "accepted",
      payment_status: "paid",
      dispatch_state: "unmatched",
      channel: "whatsapp",
      city: "Lagos",
      scheduled_from: "2026-10-09T23:00:00",
      scheduled_to: "2026-10-11T23:00:00",
      needs_address_check: "true",
      no_show: "true",
    });
  });

  it("applies the search text only on submit (Enter)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: list([A]) });
    render(withAuth(OPS, <BookingsList />));
    await screen.findByRole("row", { name: /DDDE4418/ });
    await user.type(screen.getByLabelText("Search"), "ABC");
    expect(calls).toHaveLength(1);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(calls.at(-1)?.search).toContain("q=ABC"));
  });

  it("resets to the first page when a filter changes", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: list([A], 60) });
    render(withAuth(OPS, <BookingsList />));
    await screen.findByRole("row", { name: /DDDE4418/ });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(calls.at(-1)?.search).toContain("offset=25"));
    expect(screen.getByText("26–50 of 60")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "pending");
    await waitFor(() => expect(calls.at(-1)?.search).toContain("status=pending"));
    expect(calls.at(-1)?.search).toContain("offset=0");
  });

  it("shows the PII hint only to an admin without people.pii", async () => {
    stubFetch({ [LIST]: list([A]) });
    const { unmount } = render(withAuth(FINANCE, <BookingsList />));
    expect(screen.getByText("Search by booking code. Names and phone numbers need the people.pii permission.")).toBeInTheDocument();
    unmount();
    render(withAuth(OPS, <BookingsList />));
    expect(screen.queryByText(/need the people.pii permission/)).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    stubFetch({ [LIST]: list([]) });
    render(withAuth(OPS, <BookingsList />));
    expect(await screen.findByText("No bookings match these filters")).toBeInTheDocument();
  });

  it("shows the server's 422 message when the query is rejected", async () => {
    stubFetch({
      [LIST]: () =>
        jsonResponse(
          {
            detail: [
              {
                type: "literal_error",
                loc: ["query", "status"],
                msg: "Input should be 'pending', 'accepted', 'en_route', 'in_progress', 'completed', 'cancelled' or 'declined'",
                input: "nonsense",
              },
            ],
          },
          { status: 422 },
        ),
    });
    render(withAuth(OPS, <BookingsList />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Input should be 'pending', 'accepted'");
  });
});
