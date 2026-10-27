import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { BOOKING_ID, makeDetail, makeRefund } from "@/test/refund-fixtures";

import { RefundsList } from "./refunds-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/refunds";
const FINANCE = ["refunds.approve", "payments.read"];
const OPERATIONS = ["refunds.request"];

const PENDING = makeRefund();
const PROCESSING = makeRefund({
  id: "d7b74acb-16af-4965-b6b3-5de7e7995b5b",
  booking_code: "22D0E98F",
  status: "processing",
  amount_naira: 20000.0,
  destination: "original_method",
  available_actions: [],
});
const FLAGGED = makeRefund({
  id: "650d0029-531c-4d1c-90b5-11acc207b626",
  booking_code: "E819BAF2",
  status: "succeeded",
  origin: "staff",
  reason_code: "complaint",
  amount_naira: 5000.0,
  review_flagged_at: "2026-10-21T14:29:21.705900",
  available_actions: [],
});

function list(items: ReturnType<typeof makeRefund>[], total = items.length) {
  return () => jsonResponse({ items, total, limit: 50, offset: 0 });
}

const rowOf = (name: RegExp) => screen.findByRole("row", { name });

describe("RefundsList", () => {
  it("opens on the open work list and shows the total", async () => {
    const calls = stubFetch({ [LIST]: list([PENDING, PROCESSING, FLAGGED]) });
    render(withAuth(FINANCE, <RefundsList />));
    expect(await rowOf(/780212EB/)).toHaveTextContent("₦12,000");
    expect(calls[0]?.search).toContain("status=open");
    expect(calls[0]?.search).toContain("limit=50");
    expect(calls[0]?.search).toContain("offset=0");
    expect(screen.getByText("3 refunds")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("open");
  });

  it("shows amount, reason, origin, status, flags and the way to the refund and booking", async () => {
    stubFetch({ [LIST]: list([PENDING, PROCESSING, FLAGGED]) });
    render(withAuth(FINANCE, <RefundsList />));
    const pending = await rowOf(/780212EB/);
    expect(pending).toHaveTextContent("Pending approval");
    expect(pending).toHaveTextContent("suggested");
    expect(pending).toHaveTextContent("Admin cancelled");
    expect(pending).toHaveTextContent("Raised by the system");
    expect(within(pending).getByText("Needs you")).toBeInTheDocument();
    expect(within(pending).getByRole("link", { name: "780212EB" })).toHaveAttribute("href", `/bookings/${BOOKING_ID}`);
    expect(within(pending).getByRole("link", { name: /View/ })).toHaveAttribute("href", `/queues/refunds/${PENDING.id}`);

    const processing = await rowOf(/22D0E98F/);
    expect(processing).toHaveTextContent("₦20,000");
    expect(processing).not.toHaveTextContent("suggested");
    expect(within(processing).queryByText("Needs you")).not.toBeInTheDocument();

    const flagged = await rowOf(/E819BAF2/);
    expect(flagged).toHaveTextContent("Raised by staff");
    expect(within(flagged).getByText("Flagged for review")).toBeInTheDocument();
  });

  it("says a refund with no suggested amount needs a person to enter one", async () => {
    stubFetch({ [LIST]: list([makeRefund({ suggested_amount_naira: null })]) });
    render(withAuth(FINANCE, <RefundsList />));
    expect(await rowOf(/780212EB/)).toHaveTextContent("—");
  });

  it("filters by status and goes back to the first page", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: list([PENDING], 120) });
    render(withAuth(FINANCE, <RefundsList />));
    await rowOf(/780212EB/);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(calls.some((c) => c.search.includes("offset=50"))).toBe(true));
    await user.selectOptions(screen.getByLabelText("Status"), "needs_review");
    await waitFor(() => expect(calls.some((c) => c.search.includes("status=needs_review") && c.search.includes("offset=0"))).toBe(true));
    await user.selectOptions(screen.getByLabelText("Status"), "all");
    await waitFor(() => expect(calls.some((c) => c.search.includes("status=all"))).toBe(true));
  });

  it("offers every status the guide lists, plus open and all", async () => {
    stubFetch({ [LIST]: list([PENDING]) });
    render(withAuth(FINANCE, <RefundsList />));
    await rowOf(/780212EB/);
    const options = within(screen.getByLabelText("Status")).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual([
      "open",
      "all",
      "pending_approval",
      "approved",
      "processing",
      "needs_attention",
      "needs_review",
      "failed",
      "succeeded",
      "rejected",
      "closed",
    ]);
  });

  it("pages with the total", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: list([PENDING], 120) });
    render(withAuth(FINANCE, <RefundsList />));
    await rowOf(/780212EB/);
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(calls.at(-1)?.search).toContain("offset=50"));
  });

  it("shows empty (open and filtered) and error states", async () => {
    const user = userEvent.setup();
    stubFetch({ [LIST]: list([]) });
    const { unmount } = render(withAuth(FINANCE, <RefundsList />));
    expect(await screen.findByText("No refunds")).toBeInTheDocument();
    expect(screen.getByText("Nothing needs a person right now.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "closed");
    expect(await screen.findByText("No refund has this status.")).toBeInTheDocument();
    unmount();
    stubFetch({
      [LIST]: () => jsonResponse({ detail: "Access denied. Missing permission: one of refunds.request, refunds.approve, payments.read" }, { status: 403 }),
    });
    render(withAuth(FINANCE, <RefundsList />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied. Missing permission: one of refunds.request");
  });

  it("states the approval rules", async () => {
    stubFetch({ [LIST]: list([PENDING]) });
    render(withAuth(FINANCE, <RefundsList />));
    const rules = await screen.findByRole("complementary", { name: "Refund rules" });
    expect(rules).toHaveTextContent("Finance approves up to the cumulative limit per booking");
    expect(rules).toHaveTextContent("A Super Admin approves anything above the limit");
    expect(rules).toHaveTextContent("A refund raised by staff has to be approved by a different admin.");
  });

  describe("raising a refund", () => {
    it("is offered only with refunds.request", async () => {
      stubFetch({ [LIST]: list([PENDING]) });
      const { unmount } = render(withAuth(FINANCE, <RefundsList />));
      await rowOf(/780212EB/);
      expect(screen.queryByRole("button", { name: "Raise a refund" })).not.toBeInTheDocument();
      unmount();
      stubFetch({ [LIST]: list([PENDING]) });
      render(withAuth(OPERATIONS, <RefundsList />));
      expect(await screen.findByRole("button", { name: "Raise a refund" })).toBeInTheDocument();
    });

    it("sends the booking, naira amount, reason and note, and says another admin must approve it", async () => {
      const user = userEvent.setup();
      const created = makeDetail({
        id: "650d0029-531c-4d1c-90b5-11acc207b626",
        booking_code: "E819BAF2",
        origin: "staff",
        reason_code: "complaint",
        suggested_amount_naira: 5000.0,
        available_actions: [],
      });
      const calls = stubFetch({ [LIST]: list([PENDING]), "POST /api/v1/admin/refunds": () => jsonResponse(created, { status: 201 }) });
      render(withAuth(OPERATIONS, <RefundsList />));
      await user.click(await screen.findByRole("button", { name: "Raise a refund" }));
      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", { name: "Raise refund" });
      expect(dialog).toHaveTextContent("a different admin has to approve it");
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText("Booking ID"), "not-an-id");
      await user.type(within(dialog).getByLabelText(/Amount/), "5000");
      expect(confirm).toBeDisabled();
      await user.clear(within(dialog).getByLabelText("Booking ID"));
      await user.type(within(dialog).getByLabelText("Booking ID"), "0f511a01-411a-4f5c-b4e2-22b22a67ec07");
      await user.type(within(dialog).getByLabelText(/Note/), "The family complained about the cancellation fee");
      await user.click(confirm);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === "POST /api/v1/admin/refunds")?.body).toEqual({
        booking_id: "0f511a01-411a-4f5c-b4e2-22b22a67ec07",
        amount_naira: 5000,
        reason_code: "complaint",
        note: "The family complained about the cancellation fee",
      });
      expect(await screen.findByRole("status")).toHaveTextContent("Refund raised for booking E819BAF2. Another admin has to approve it");
    });

    it("rejects an amount with more than two decimals or zero before sending", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({ [LIST]: list([PENDING]) });
      render(withAuth(OPERATIONS, <RefundsList />));
      await user.click(await screen.findByRole("button", { name: "Raise a refund" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Booking ID"), "0f511a01-411a-4f5c-b4e2-22b22a67ec07");
      for (const bad of ["12.345", "0", "-5", "abc"]) {
        await user.clear(within(dialog).getByLabelText(/Amount/));
        await user.type(within(dialog).getByLabelText(/Amount/), bad);
        expect(within(dialog).getByRole("button", { name: "Raise refund" })).toBeDisabled();
      }
      expect(calls.some((c) => c.key === "POST /api/v1/admin/refunds")).toBe(false);
    });

    it("shows the server's refusal, with its kobo amount in naira", async () => {
      const user = userEvent.setup();
      stubFetch({
        [LIST]: list([PENDING]),
        "POST /api/v1/admin/refunds": () =>
          jsonResponse({ detail: "The amount must be between 1 and 5500000 kobo, what is left to refund" }, { status: 422 }),
      });
      render(withAuth(OPERATIONS, <RefundsList />));
      await user.click(await screen.findByRole("button", { name: "Raise a refund" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Booking ID"), "0f511a01-411a-4f5c-b4e2-22b22a67ec07");
      await user.type(within(dialog).getByLabelText(/Amount/), "60000");
      await user.click(within(dialog).getByRole("button", { name: "Raise refund" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("The amount must be between ₦0.01 and ₦55,000, what is left to refund");
    });
  });
});
