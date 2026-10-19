import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { FAILING, LATE_SUCCESS, makePayout } from "@/test/payout-fixtures";

import { Attention } from "./attention-queue";

vi.mock("next/navigation", () => ({ usePathname: () => "/money/payouts/attention" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/payouts";
const SUPER = ["payments.read", "ledger.adjust"];
// Frozen but nothing open any more: its payout was resolved as failed, the freeze stays until unfrozen (capture 221/222).
const RESOLVED_FROZEN = makePayout({
  id: "93d04961-704d-4177-abfa-39f35a0b7b76",
  caregiver_id: "86f02657-cb3e-40b0-8870-a924cd8ff1d9",
  caregiver_name: "Placeholder Failing",
  status: "failed",
  caregiver_payouts_frozen_at: "2026-10-12T16:52:11.148460",
  caregiver_payouts_frozen_reason: "Payout 93d04961: Paystack reported attempt 2 as reversed after it had been paid.",
});

/** One handler for both queries on this screen: the attention query filters by status, the recent scan doesn't. */
function stubList(attention: unknown[], recent: unknown[]) {
  return stubFetch({
    [LIST]: (req) => {
      const items = new URL(req.url).searchParams.get("status") === "needs_attention" ? attention : recent;
      return jsonResponse({ items, total: items.length });
    },
    [`POST /api/v1/admin/payouts/caregivers/${LATE_SUCCESS.caregiver_id}/unfreeze`]: () =>
      jsonResponse({
        caregiver_id: LATE_SUCCESS.caregiver_id,
        payouts_frozen_at: null,
        debited_from_balance_kobo: 800000,
        written_off_shortfall_kobo: 0,
        outstanding_shortfall_kobo: 0,
      }),
  });
}

describe("Attention", () => {
  it("lists payouts that need a person and the frozen caregivers, with the freeze reason verbatim", async () => {
    stubList([LATE_SUCCESS], [LATE_SUCCESS, RESOLVED_FROZEN]);
    render(withAuth(SUPER, <Attention />));
    const attention = await screen.findByRole("table", { name: "Payouts needing attention" });
    expect(within(attention).getByRole("row", { name: /Late Success/ })).toHaveTextContent("Needs a person");
    const frozen = await screen.findByRole("table", { name: "Frozen caregivers" });
    const late = within(frozen).getByRole("row", { name: /Late Success/ });
    expect(late).toHaveTextContent("₦8,000");
    expect(late).toHaveTextContent("800000 kobo could not be recovered (shortfall)");
    expect(late).toHaveTextContent("1"); // open payouts
    // A caregiver whose payout was already resolved is still frozen and still listed, with nothing open.
    expect(within(frozen).getByRole("row", { name: /Placeholder Failing/ })).toBeInTheDocument();
  });

  it("shows empty states when nothing is wrong", async () => {
    stubList([], [FAILING]);
    render(withAuth(SUPER, <Attention />));
    expect(await screen.findByText("Nothing needs attention")).toBeInTheDocument();
    expect(await screen.findByText("No frozen caregivers")).toBeInTheDocument();
  });

  it("shows an error when the queue cannot load", async () => {
    stubFetch({ [LIST]: () => jsonResponse({ detail: "Access denied. Missing permission: payments.read" }, { status: 403 }) });
    render(withAuth(SUPER, <Attention />));
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("Access denied. Missing permission: payments.read");
  });

  it("explains the shortfall debit before unfreezing, then sends the reason with write_off_shortfall false", async () => {
    const user = userEvent.setup();
    const calls = stubList([LATE_SUCCESS], [LATE_SUCCESS]);
    render(withAuth(SUPER, <Attention />));
    const frozen = await screen.findByRole("table", { name: "Frozen caregivers" });
    await user.click(within(frozen).getByRole("button", { name: /Unfreeze/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Unfreeze Placeholder Late Success?");
    expect(dialog).toHaveTextContent("Paystack paid ₦8,000 beyond what they earned");
    expect(dialog).toHaveTextContent("debited from their available balance");
    await user.type(within(dialog).getByLabelText(/Reason for unfreezing/), "Paystack confirmed; shortfall taken from earnings");
    await user.click(within(dialog).getByRole("button", { name: "Unfreeze" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((c) => c.key.endsWith("/unfreeze"))?.body).toEqual({
      reason: "Paystack confirmed; shortfall taken from earnings",
      write_off_shortfall: false,
    });
    expect(await screen.findByRole("status")).toHaveTextContent("can be paid again");
  });

  it("sends write_off_shortfall: true only when the box is ticked", async () => {
    const user = userEvent.setup();
    const calls = stubList([LATE_SUCCESS], [LATE_SUCCESS]);
    render(withAuth(SUPER, <Attention />));
    await user.click(within(await screen.findByRole("table", { name: "Frozen caregivers" })).getByRole("button", { name: /Unfreeze/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText(/Write off any shortfall/));
    await user.type(within(dialog).getByLabelText(/Reason for unfreezing/), "Caregiver agreed to a write-off");
    await user.click(within(dialog).getByRole("button", { name: "Unfreeze" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((c) => c.key.endsWith("/unfreeze"))?.body).toEqual({
      reason: "Caregiver agreed to a write-off",
      write_off_shortfall: true,
    });
  });

  it.each([
    "1 payout(s) of this caregiver still need attention or are processing (b10cabbd-4b38-450f-8bdd-4ed37ebfbb94). Resolve them first",
    "This caregiver still owes 800000 kobo that Paystack paid beyond their earnings, even after 0 kobo is taken from their available balance. Unfreeze with write_off_shortfall to write it off, or leave them frozen",
  ])("shows the server's unfreeze refusal verbatim: %s", async (detail) => {
    const user = userEvent.setup();
    stubFetch({
      [LIST]: () => jsonResponse({ items: [LATE_SUCCESS], total: 1 }),
      [`POST /api/v1/admin/payouts/caregivers/${LATE_SUCCESS.caregiver_id}/unfreeze`]: () => jsonResponse({ detail }, { status: 409 }),
    });
    render(withAuth(SUPER, <Attention />));
    await user.click(within(await screen.findByRole("table", { name: "Frozen caregivers" })).getByRole("button", { name: /Unfreeze/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Reason for unfreezing/), "x");
    await user.click(within(dialog).getByRole("button", { name: "Unfreeze" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(detail);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides Unfreeze and Resolve from an admin without ledger.adjust", async () => {
    stubList([LATE_SUCCESS], [LATE_SUCCESS]);
    render(withAuth(["payments.read"], <Attention />));
    await screen.findByRole("table", { name: "Frozen caregivers" });
    expect(screen.queryByRole("button", { name: /Unfreeze|Resolve/ })).not.toBeInTheDocument();
  });

  it("offers the write-off only after the server says a shortfall is left", async () => {
    const user = userEvent.setup();
    const noShortfall = { ...LATE_SUCCESS, shortfall_kobo: 0 };
    const msg =
      "This caregiver still owes 500000 kobo that Paystack paid beyond their earnings, even after 0 kobo is taken from their available balance. Unfreeze with write_off_shortfall to write it off, or leave them frozen";
    stubFetch({
      [LIST]: () => jsonResponse({ items: [noShortfall], total: 1 }),
      [`POST /api/v1/admin/payouts/caregivers/${LATE_SUCCESS.caregiver_id}/unfreeze`]: () => jsonResponse({ detail: msg }, { status: 409 }),
    });
    render(withAuth(SUPER, <Attention />));
    await user.click(within(await screen.findByRole("table", { name: "Frozen caregivers" })).getByRole("button", { name: /Unfreeze/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText(/Write off any shortfall/)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason for unfreezing/), "x");
    await user.click(within(dialog).getByRole("button", { name: "Unfreeze" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(msg);
    expect(within(dialog).getByLabelText(/Write off any shortfall/)).toBeInTheDocument();
  });

  it("reports what the unfreeze debited and wrote off", async () => {
    const user = userEvent.setup();
    stubList([LATE_SUCCESS], [LATE_SUCCESS]);
    render(withAuth(SUPER, <Attention />));
    await user.click(within(await screen.findByRole("table", { name: "Frozen caregivers" })).getByRole("button", { name: /Unfreeze/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Reason for unfreezing/), "ok");
    await user.click(within(dialog).getByRole("button", { name: "Unfreeze" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Debited from their balance: ₦8,000. Written off: ₦0.");
  });
});
